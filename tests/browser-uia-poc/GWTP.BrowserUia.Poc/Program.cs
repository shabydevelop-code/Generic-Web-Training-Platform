using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Automation;
using Forms = System.Windows.Forms;

namespace GWTP.BrowserUia.Poc;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Forms.Application.EnableVisualStyles();
        Forms.Application.SetCompatibleTextRenderingDefault(false);
        Forms.Application.Run(new PocForm());
    }
}

internal sealed class PocForm : Forms.Form
{
    private readonly Forms.Button _pick = new() { Text = "Pick browser element", AutoSize = true };
    private readonly Forms.Button _find = new() { Text = "Find again", AutoSize = true, Enabled = false };
    private readonly Forms.Button _read = new() { Text = "Read value", AutoSize = true, Enabled = false };
    private readonly Forms.Button _track = new() { Text = "Start tracking", AutoSize = true, Enabled = false };
    private readonly Forms.Label _status = new() { AutoSize = true, Text = "Open Chrome or Edge normally, then pick an element inside the page." };
    private readonly Forms.TextBox _details = new() { Multiline = true, ReadOnly = true, ScrollBars = Forms.ScrollBars.Vertical, Dock = Forms.DockStyle.Fill };
    private readonly Forms.Timer _timer = new() { Interval = 16 };
    private readonly OverlayForm _overlay = new();

    private BrowserDescriptor? _descriptor;
    private AutomationElement? _hovered;
    private AutomationElement? _selectedElement;
    private bool _picking;
    private bool _mouseWasDown;
    private bool _armed;
    private bool _tracking;
    private AutomationElement? _trackedElement;
    private AutomationPropertyChangedEventHandler? _trackedPropertyHandler;
    private StructureChangedEventHandler? _trackedStructureHandler;
    private WinEventDelegate? _browserLocationHandler;
    private IntPtr _browserLocationHook;
    private IntPtr _trackedBrowserWindow;
    private Rectangle _trackedBrowserBounds;

    public PocForm()
    {
        Text = "GWTP Browser UIA POC";
        Width = 720;
        Height = 560;
        StartPosition = Forms.FormStartPosition.CenterScreen;

        var buttons = new Forms.FlowLayoutPanel { Dock = Forms.DockStyle.Top, AutoSize = true, Padding = new Padding(8) };
        buttons.Controls.AddRange(new Forms.Control[] { _pick, _find, _read, _track });
        _status.Dock = Forms.DockStyle.Top;
        _status.Padding = new Padding(10, 6, 10, 8);

        Controls.Add(_details);
        Controls.Add(_status);
        Controls.Add(buttons);

        _pick.Click += (_, _) => TogglePicker();
        _find.Click += (_, _) => FindAgain();
        _read.Click += (_, _) => ReadValue();
        _track.Click += (_, _) => ToggleTracking();
        _timer.Tick += (_, _) => TimerTick();
        FormClosed += (_, _) =>
        {
            StopEventTracking();
            _overlay.Close();
        };
    }

    private void TogglePicker()
    {
        if (_picking)
        {
            StopPicker("Selection cancelled.");
            return;
        }

        _picking = true;
        _armed = false;
        _mouseWasDown = IsLeftDown();
        _pick.Text = "Cancel";
        _status.Text = "Move over a web-page element in Chrome/Edge and left-click it.";
        _timer.Start();
    }

    private void TimerTick()
    {
        if (_tracking)
        {
            TrackTick();
            return;
        }

        PickerTick();
    }

    private void PickerTick()
    {
        var down = IsLeftDown();

        if (!_armed)
        {
            if (!down) _armed = true;
            _mouseWasDown = down;
            return;
        }

        var point = Forms.Cursor.Position;
        try
        {
            var element = AutomationElement.FromPoint(new System.Windows.Point(point.X, point.Y));
            if (element is not null &&
                element.Current.ProcessId != Environment.ProcessId &&
                IsBrowserElement(element))
            {
                _hovered = element;
                ShowOverlay(element);
                _status.Text = "Browser UIA element detected. Click to select.";
            }
            else
            {
                _hovered = null;
                _overlay.Hide();
                _status.Text = "Move over content inside Chrome or Edge.";
            }
        }
        catch (ElementNotAvailableException)
        {
            _hovered = null;
            _overlay.Hide();
        }

        if (down && !_mouseWasDown && _hovered is not null)
            SelectHovered();

        _mouseWasDown = down;
    }

    private void SelectHovered()
    {
        try
        {
            _selectedElement = _hovered!;
            _descriptor = BrowserDescriptor.FromElement(_selectedElement);
            _details.Text = JsonSerializer.Serialize(_descriptor, new JsonSerializerOptions { WriteIndented = true });
            _find.Enabled = true;
            _read.Enabled = true;
            _track.Enabled = true;
            StopPicker("Selected. Descriptor captured from UI Automation only.");
            ShowOverlay(_hovered!);
        }
        catch (Exception ex)
        {
            StopPicker($"Selection failed: {ex.Message}");
        }
    }

    private void ToggleTracking()
    {
        if (_descriptor is null) return;

        _tracking = !_tracking;
        _track.Text = _tracking ? "Stop tracking" : "Start tracking";

        if (_tracking)
        {
            _pick.Enabled = false;
            _find.Enabled = false;
            _read.Enabled = false;
            _status.Text = "Tracking selected target. Scroll, resize, refresh, or change the page.";
            if (!TryAttachSelectedElement())
                ResolveAndAttachTracking();
            _timer.Start();
        }
        else
        {
            _timer.Stop();
            StopEventTracking();
            _pick.Enabled = true;
            _find.Enabled = true;
            _read.Enabled = true;
            _status.Text = "Tracking stopped.";
        }
    }

    private void TrackTick()
    {
        if (!_tracking || _trackedElement is null) return;

        try
        {
            if (_trackedElement.Current.IsOffscreen)
            {
                _overlay.Hide();
                return;
            }

            ShowOverlay(_trackedElement);
        }
        catch (ElementNotAvailableException)
        {
            ResolveAndAttachTracking();
        }
    }

    private bool TryAttachSelectedElement()
    {
        if (_selectedElement is null) return false;

        try
        {
            _ = _selectedElement.Current.ProcessId;
            AttachTracking(_selectedElement, "Tracking: original selected target attached; listening for UIA and browser-window changes.");
            return true;
        }
        catch (ElementNotAvailableException)
        {
            _selectedElement = null;
            return false;
        }
    }

    private void ResolveAndAttachTracking()
    {
        if (_descriptor is null) return;

        StopEventTracking();
        var matches = BrowserResolver.Find(_descriptor);
        if (matches.Count != 1)
        {
            _overlay.Hide();
            _status.Text = matches.Count == 0
                ? "Tracking: target unavailable."
                : $"Tracking: ambiguous ({matches.Count} matches).";
            return;
        }

        AttachTracking(matches[0], "Tracking: target rediscovered; listening for UIA and browser-window changes.");
    }

    private void AttachTracking(AutomationElement element, string status)
    {
        StopEventTracking();
        _trackedElement = element;
        _trackedBrowserWindow = FindTopLevelWindow(_trackedElement);
        _trackedBrowserBounds = TryGetWindowBounds(_trackedBrowserWindow, out var browserBounds) ? browserBounds : Rectangle.Empty;
        ShowOverlay(_trackedElement);
        _status.Text = status;

        _trackedPropertyHandler = (_, _) => BeginInvoke(new Action(RefreshTrackedBounds));
        _trackedStructureHandler = (_, _) => BeginInvoke(new Action(ResolveAndAttachTracking));

        try
        {
            Automation.AddAutomationPropertyChangedEventHandler(
                _trackedElement,
                TreeScope.Element,
                _trackedPropertyHandler,
                AutomationElement.BoundingRectangleProperty,
                AutomationElement.IsOffscreenProperty);

            Automation.AddStructureChangedEventHandler(
                _trackedElement,
                TreeScope.Subtree,
                _trackedStructureHandler);

            StartBrowserLocationTracking();
        }
        catch (ElementNotAvailableException)
        {
            ResolveAndAttachTracking();
        }
    }

    private void RefreshTrackedBounds()
    {
        if (!_tracking || _trackedElement is null) return;

        try
        {
            if (_trackedElement.Current.IsOffscreen)
            {
                _overlay.Hide();
                _status.Text = "Tracking: target is offscreen.";
                return;
            }

            ShowOverlay(_trackedElement);
            _status.Text = "Tracking: target bounds updated by UIA event.";
        }
        catch (ElementNotAvailableException)
        {
            ResolveAndAttachTracking();
        }
    }

    private void StartBrowserLocationTracking()
    {
        if (_trackedElement is null || _trackedBrowserWindow == IntPtr.Zero) return;

        uint processId;
        GetWindowThreadProcessId(_trackedBrowserWindow, out processId);
        if (processId == 0) return;

        _browserLocationHandler = (_, eventType, hwnd, idObject, _, _, _) =>
        {
            if (!_tracking || eventType != EventObjectLocationChange || hwnd == IntPtr.Zero) return;
            if (idObject != ObjIdWindow) return;
            if (GetAncestor(hwnd, GaRoot) != _trackedBrowserWindow) return;

            try
            {
                BeginInvoke(new Action(ApplyBrowserWindowDelta));
            }
            catch (InvalidOperationException)
            {
            }
        };

        _browserLocationHook = SetWinEventHook(
            EventObjectLocationChange,
            EventObjectLocationChange,
            IntPtr.Zero,
            _browserLocationHandler,
            processId,
            0,
            WinEventOutOfContext);
    }

    private void ApplyBrowserWindowDelta()
    {
        if (!_tracking || _trackedBrowserWindow == IntPtr.Zero) return;
        if (!TryGetWindowBounds(_trackedBrowserWindow, out var currentBounds)) return;
        if (!_trackedBrowserBounds.IsEmpty && _overlay.Visible)
        {
            var dx = currentBounds.Left - _trackedBrowserBounds.Left;
            var dy = currentBounds.Top - _trackedBrowserBounds.Top;
            if (dx != 0 || dy != 0) _overlay.MoveBy(dx, dy);
        }
        _trackedBrowserBounds = currentBounds;
    }

    private static bool TryGetWindowBounds(IntPtr hwnd, out Rectangle bounds)
    {
        bounds = Rectangle.Empty;
        if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out var rect)) return false;
        bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);
        return true;
    }

    private static IntPtr FindTopLevelWindow(AutomationElement element)
    {
        var walker = TreeWalker.RawViewWalker;
        var current = element;

        while (current is not null)
        {
            try
            {
                var hwnd = new IntPtr(current.Current.NativeWindowHandle);
                if (hwnd != IntPtr.Zero)
                    return GetAncestor(hwnd, GaRoot);

                var parent = walker.GetParent(current);
                if (parent is null || parent == AutomationElement.RootElement) break;
                current = parent;
            }
            catch (ElementNotAvailableException)
            {
                break;
            }
        }

        return IntPtr.Zero;
    }

    private void StopEventTracking()
    {
        if (_trackedElement is not null)
        {
            try
            {
                if (_trackedPropertyHandler is not null)
                    Automation.RemoveAutomationPropertyChangedEventHandler(_trackedElement, _trackedPropertyHandler);
                if (_trackedStructureHandler is not null)
                    Automation.RemoveStructureChangedEventHandler(_trackedElement, _trackedStructureHandler);
            }
            catch (ElementNotAvailableException)
            {
            }
        }

        if (_browserLocationHook != IntPtr.Zero)
        {
            UnhookWinEvent(_browserLocationHook);
            _browserLocationHook = IntPtr.Zero;
        }

        _trackedBrowserWindow = IntPtr.Zero;
        _trackedBrowserBounds = Rectangle.Empty;
        _browserLocationHandler = null;
        _trackedElement = null;
        _trackedPropertyHandler = null;
        _trackedStructureHandler = null;
    }

    private void FindAgain()
    {
        if (_descriptor is null) return;

        var matches = BrowserResolver.Find(_descriptor);
        if (matches.Count == 1)
        {
            ShowOverlay(matches[0]);
            _status.Text = "Rediscovery succeeded: exactly one matching element.";
            return;
        }

        _overlay.Hide();
        _status.Text = matches.Count == 0
            ? "Rediscovery failed: no matching element."
            : $"Rediscovery is ambiguous: {matches.Count} matching elements.";
    }

    private void ReadValue()
    {
        if (_descriptor is null) return;

        var matches = BrowserResolver.Find(_descriptor);
        if (matches.Count != 1)
        {
            _status.Text = matches.Count == 0
                ? "Cannot read value: target not found."
                : "Cannot read value: target is ambiguous.";
            return;
        }

        _status.Text = TryReadValue(matches[0], out var value)
            ? $"Current value: {value}"
            : "Target exposes neither ValuePattern nor TextPattern.";
    }

    private static bool TryReadValue(AutomationElement element, out string value)
    {
        value = string.Empty;

        try
        {
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valueObject) &&
                valueObject is ValuePattern valuePattern)
            {
                value = valuePattern.Current.Value ?? string.Empty;
                return true;
            }

            if (element.TryGetCurrentPattern(TextPattern.Pattern, out var textObject) &&
                textObject is TextPattern textPattern)
            {
                value = textPattern.DocumentRange.GetText(-1).TrimEnd('\r', '\n');
                return true;
            }
        }
        catch (ElementNotAvailableException)
        {
        }

        return false;
    }

    private static bool IsBrowserElement(AutomationElement element)
    {
        try
        {
            var processName = Process.GetProcessById(element.Current.ProcessId).ProcessName;
            return processName.Equals("chrome", StringComparison.OrdinalIgnoreCase) ||
                   processName.Equals("msedge", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private void ShowOverlay(AutomationElement element)
    {
        try
        {
            var bounds = element.Current.BoundingRectangle;
            if (bounds.IsEmpty || bounds.Width <= 0 || bounds.Height <= 0)
            {
                _overlay.Hide();
                return;
            }

            _overlay.ShowAt(Rectangle.Round(new RectangleF(
                (float)bounds.X, (float)bounds.Y, (float)bounds.Width, (float)bounds.Height)));
        }
        catch (ElementNotAvailableException)
        {
            _overlay.Hide();
        }
    }

    private void StopPicker(string message)
    {
        _timer.Stop();
        _picking = false;
        _pick.Text = "Pick browser element";
        _status.Text = message;
    }

    private static bool IsLeftDown() => (GetAsyncKeyState(0x01) & 0x8000) != 0;

    private const uint EventObjectLocationChange = 0x800B;
    private const int ObjIdWindow = 0;
    private const uint WinEventOutOfContext = 0x0000;
    private const uint GaRoot = 2;

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private delegate void WinEventDelegate(
        IntPtr hWinEventHook,
        uint eventType,
        IntPtr hwnd,
        int idObject,
        int idChild,
        uint idEventThread,
        uint eventTime);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWinEventHook(
        uint eventMin,
        uint eventMax,
        IntPtr hmodWinEventProc,
        WinEventDelegate lpfnWinEventProc,
        uint idProcess,
        uint idThread,
        uint flags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hwnd, out NativeRect rect);
}

internal sealed record BrowserDescriptor(
    string ProcessName,
    string ControlType,
    string Name,
    string AutomationId,
    IReadOnlyList<BrowserAncestor> Ancestors)
{
    public static BrowserDescriptor FromElement(AutomationElement element)
    {
        var ancestors = new List<BrowserAncestor>();
        var walker = TreeWalker.ControlViewWalker;
        var current = element;

        for (var depth = 0; depth < 12; depth++)
        {
            AutomationElement? parent;
            try { parent = walker.GetParent(current); }
            catch { break; }

            if (parent is null || parent == AutomationElement.RootElement) break;

            var p = parent.Current;
            ancestors.Add(new BrowserAncestor(
                p.ControlType.ProgrammaticName,
                p.Name ?? string.Empty,
                p.AutomationId ?? string.Empty));
            current = parent;
        }

        var c = element.Current;
        return new BrowserDescriptor(
            Process.GetProcessById(c.ProcessId).ProcessName,
            c.ControlType.ProgrammaticName,
            c.Name ?? string.Empty,
            c.AutomationId ?? string.Empty,
            ancestors);
    }
}

internal sealed record BrowserAncestor(string ControlType, string Name, string AutomationId);

internal static class BrowserResolver
{
    public static List<AutomationElement> Find(BrowserDescriptor descriptor)
    {
        var result = new List<AutomationElement>();
        var processIds = Process.GetProcessesByName(descriptor.ProcessName)
            .Select(process => process.Id)
            .ToHashSet();

        if (processIds.Count == 0) return result;

        var controlType = AllControlTypes()
            .FirstOrDefault(type => type.ProgrammaticName == descriptor.ControlType)
            ?? ControlType.Custom;

        AutomationElementCollection candidates;
        try
        {
            candidates = AutomationElement.RootElement.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, controlType));
        }
        catch
        {
            return result;
        }

        foreach (AutomationElement candidate in candidates)
        {
            try
            {
                var c = candidate.Current;
                if (!processIds.Contains(c.ProcessId)) continue;
                if (descriptor.AutomationId.Length > 0 && c.AutomationId != descriptor.AutomationId) continue;
                if (descriptor.Name.Length > 0 && c.Name != descriptor.Name) continue;
                if (!AncestorsMatch(candidate, descriptor.Ancestors)) continue;

                result.Add(candidate);
                if (result.Count > 20) break;
            }
            catch (ElementNotAvailableException)
            {
            }
        }

        return result;
    }

    private static IEnumerable<ControlType> AllControlTypes() =>
        typeof(ControlType)
            .GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
            .Select(field => field.GetValue(null))
            .OfType<ControlType>();

    private static bool AncestorsMatch(
        AutomationElement element,
        IReadOnlyList<BrowserAncestor> expected)
    {
        var walker = TreeWalker.ControlViewWalker;
        var current = element;

        foreach (var expectedAncestor in expected)
        {
            AutomationElement? parent;
            try { parent = walker.GetParent(current); }
            catch { return false; }

            if (parent is null) return false;

            var p = parent.Current;
            if (p.ControlType.ProgrammaticName != expectedAncestor.ControlType) return false;
            if (expectedAncestor.AutomationId.Length > 0 &&
                p.AutomationId != expectedAncestor.AutomationId) return false;
            if (expectedAncestor.Name.Length > 0 &&
                p.Name != expectedAncestor.Name) return false;

            current = parent;
        }

        return true;
    }
}

internal sealed class OverlayForm : Forms.Form
{
    public OverlayForm()
    {
        FormBorderStyle = Forms.FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.Magenta;
        TransparencyKey = Color.Magenta;
    }

    protected override bool ShowWithoutActivation => true;

    protected override void OnPaint(Forms.PaintEventArgs e)
    {
        using var pen = new Pen(Color.DeepSkyBlue, 3);
        e.Graphics.DrawRectangle(pen, 1, 1, Math.Max(1, Width - 3), Math.Max(1, Height - 3));
    }

    public void ShowAt(Rectangle bounds)
    {
        Bounds = bounds;
        if (!Visible) Show();
        Invalidate();
    }

    public void MoveBy(int dx, int dy)
    {
        if (!Visible) return;
        Location = new Point(Left + dx, Top + dy);
    }

    protected override Forms.CreateParams CreateParams
    {
        get
        {
            const int WsExTransparent = 0x20;
            const int WsExToolWindow = 0x80;
            const int WsExNoActivate = 0x08000000;
            var cp = base.CreateParams;
            cp.ExStyle |= WsExTransparent | WsExToolWindow | WsExNoActivate;
            return cp;
        }
    }
}
