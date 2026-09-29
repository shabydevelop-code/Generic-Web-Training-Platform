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
        Forms.ApplicationConfiguration.Initialize();
        Forms.Application.Run(new PocForm());
    }
}

internal sealed class PocForm : Forms.Form
{
    private readonly Forms.Button _pick = new() { Text = "Pick browser element", AutoSize = true };
    private readonly Forms.Button _find = new() { Text = "Find again", AutoSize = true, Enabled = false };
    private readonly Forms.Button _read = new() { Text = "Read value", AutoSize = true, Enabled = false };
    private readonly Forms.Label _status = new() { AutoSize = true, Text = "Open Chrome or Edge normally, then pick an element inside the page." };
    private readonly Forms.TextBox _details = new() { Multiline = true, ReadOnly = true, ScrollBars = Forms.ScrollBars.Vertical, Dock = Forms.DockStyle.Fill };
    private readonly Forms.Timer _timer = new() { Interval = 40 };
    private readonly OverlayForm _overlay = new();

    private BrowserDescriptor? _descriptor;
    private AutomationElement? _hovered;
    private bool _picking;
    private bool _mouseWasDown;
    private bool _armed;

    public PocForm()
    {
        Text = "GWTP Browser UIA POC";
        Width = 720;
        Height = 560;
        StartPosition = Forms.FormStartPosition.CenterScreen;

        var buttons = new Forms.FlowLayoutPanel { Dock = Forms.DockStyle.Top, AutoSize = true, Padding = new Padding(8) };
        buttons.Controls.AddRange(new Forms.Control[] { _pick, _find, _read });
        _status.Dock = Forms.DockStyle.Top;
        _status.Padding = new Padding(10, 6, 10, 8);

        Controls.Add(_details);
        Controls.Add(_status);
        Controls.Add(buttons);

        _pick.Click += (_, _) => TogglePicker();
        _find.Click += (_, _) => FindAgain();
        _read.Click += (_, _) => ReadValue();
        _timer.Tick += (_, _) => PickerTick();
        FormClosed += (_, _) => _overlay.Close();
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
            _descriptor = BrowserDescriptor.FromElement(_hovered!);
            _details.Text = JsonSerializer.Serialize(_descriptor, new JsonSerializerOptions { WriteIndented = true });
            _find.Enabled = true;
            _read.Enabled = true;
            StopPicker("Selected. Descriptor captured from UI Automation only.");
            ShowOverlay(_hovered!);
        }
        catch (Exception ex)
        {
            StopPicker($"Selection failed: {ex.Message}");
        }
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

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);
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
