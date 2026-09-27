using System.IO;
using System.Diagnostics;
using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using Forms = System.Windows.Forms;

internal static class Program
{
    private const int TimeoutMs = 3000;
    private const int LaunchTimeoutMs = 10000;
    private const int HumanStepPauseMs = 100;
    private const int VisualPickerPauseMs = 200;
    private static int _passed;
    private static int _failed;

    [STAThread]
    private static int Main(string[] args)
    {
        var selectedTests = ParseSelectedTests(args);
        var root = FindRepoRoot();
        var runtimeExe = Path.Combine(root, "windows-runtime", "GWTP.Windows.Runtime", "bin", "Debug", "net8.0-windows", "GWTP.Windows.Runtime.exe");
        var hostExe = Path.Combine(root, "tests", "windows", "GWTP.Windows.TestHost", "bin", "Debug", "net8.0-windows", "GWTP.Windows.TestHost.exe");

        if (!File.Exists(runtimeExe) || !File.Exists(hostExe))
        {
            Console.Error.WriteLine("Build outputs are missing. Run run-sanity.ps1 so both GUI applications are built first.");
            return 2;
        }

        using var runtime = Process.Start(new ProcessStartInfo(runtimeExe) { UseShellExecute = true });
        if (runtime is null) return 2;

        try
        {
            if (selectedTests is not null && selectedTests.SetEquals(new[] { 17, 18 }))
            {
                var focusedRuntimeWindow = WaitForWindow(runtime.Id, "GWTP Windows Runtime");
                Invoke(FindByName(focusedRuntimeWindow, "Open Ambiguity Test"));
                var focusedHostWindow = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);

                // Reproduce the exact lifecycle boundary suspected of leaking state:
                // an active target disappears and returns, then T08 authors a duplicate
                // leaf while a second same-process window exists.
                Run("17. T07 active dynamic target hides when removed and returns event-driven", () =>
                {
                    PrepareHostTargetForPicker(focusedRuntimeWindow, focusedHostWindow, automationId: "AppearingTarget");
                    var target = FindByAutomationId(focusedHostWindow, "AppearingTarget");
                    SelectThroughRealPicker(focusedRuntimeWindow, target);
                    Invoke(FindByName(focusedHostWindow, "Toggle dynamic target"));
                    WaitUntil(() => TryFindRuntimeWindow(runtime.Id, "GWTP Guidance") is null &&
                                    TryFindRuntimeWindow(runtime.Id, "GWTP Highlight") is null,
                        "Active dynamic target overlays remained after target disappeared.");
                    Invoke(FindByName(focusedHostWindow, "Toggle dynamic target"));
                    WaitUntil(() => TryFindByAutomationId(focusedHostWindow, "AppearingTarget") is not null,
                        "Dynamic target did not return to the host.");
                });

                Run("18. T08 duplicate leaf in second same-process window does not steal authored target", () =>
                {
                    Invoke(FindByName(focusedHostWindow, "Open second test window"));
                    var second = WaitForTopLevelWindow("GWTP UIA Test Host — Second Window", LaunchTimeoutMs);
                    var secondDuplicate = FindByAutomationId(second, "SharedContinue");
                    Require(secondDuplicate.Current.ProcessId == focusedHostWindow.Current.ProcessId,
                        "Second-window duplicate is not in the same process.");

                    var secondHwnd = new IntPtr(second.Current.NativeWindowHandle);
                    ShowWindow(secondHwnd, SwMinimize);
                    WaitUntil(() =>
                    {
                        var pattern = (WindowPattern)second.GetCurrentPattern(WindowPattern.Pattern);
                        return pattern.Current.WindowVisualState == WindowVisualState.Minimized;
                    }, "Second test window did not minimize before authored target selection.");

                    PrepareHostTargetForPicker(focusedRuntimeWindow, focusedHostWindow, automationId: "GroupA");
                    var authored = FindTargetWithinGroup(focusedHostWindow, "GroupA", "SharedContinue");
                    SelectThroughRealPicker(focusedRuntimeWindow, authored);
                    WaitUntil(() => IsOverlayAttached(runtime.Id, authored),
                        "Could not author the main-window duplicate after T07.");

                    var hostHwnd = new IntPtr(focusedHostWindow.Current.NativeWindowHandle);
                    ShowWindow(secondHwnd, SwRestore);
                    SetForegroundWindow(hostHwnd);
                    WaitUntil(() => GetForegroundWindow() == hostHwnd,
                        "Authored host did not regain foreground before T08 rediscovery.");

                    Invoke(FindByAutomationId(focusedRuntimeWindow, "FindElementButton"));
                    SetForegroundWindow(hostHwnd);
                    WaitUntil(() => IsOverlayAttached(runtime.Id, authored),
                        "Same-process second-window duplicate stole the authored target.");
                });

                Console.WriteLine();
                Console.WriteLine($"Windows GUI sanity: {_passed} passed, {_failed} failed");
                return _failed == 0 ? 0 : 1;
            }

            if (selectedTests is not null && selectedTests.SetEquals(new[] { 18 }))
            {
                var focusedRuntimeWindow = WaitForWindow(runtime.Id, "GWTP Windows Runtime");
                Invoke(FindByName(focusedRuntimeWindow, "Open Ambiguity Test"));
                var focusedHostWindow = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);

                Invoke(FindByName(focusedHostWindow, "Open second test window"));
                var focusedSecondWindow = WaitForTopLevelWindow("GWTP UIA Test Host — Second Window", LaunchTimeoutMs);
                var focusedSecondDuplicate = FindByAutomationId(focusedSecondWindow, "SharedContinue");
                Require(focusedSecondDuplicate.Current.ProcessId == focusedHostWindow.Current.ProcessId,
                    "Focused T08 setup did not create the duplicate in the same process.");

                var focusedSecondHwnd = new IntPtr(focusedSecondWindow.Current.NativeWindowHandle);
                ShowWindow(focusedSecondHwnd, SwMinimize);
                WaitUntil(() =>
                {
                    var pattern = (WindowPattern)focusedSecondWindow.GetCurrentPattern(WindowPattern.Pattern);
                    return pattern.Current.WindowVisualState == WindowVisualState.Minimized;
                }, "Focused T08 setup could not minimize the second window.");

                PrepareHostTargetForPicker(focusedRuntimeWindow, focusedHostWindow, automationId: "GroupA");
                var focusedAuthored = FindTargetWithinGroup(focusedHostWindow, "GroupA", "SharedContinue");
                SelectThroughRealPicker(focusedRuntimeWindow, focusedAuthored);
                WaitUntil(() => IsOverlayAttached(runtime.Id, focusedAuthored),
                    "Focused T08 setup could not author the main-window duplicate.");

                Run("18. T08 duplicate leaf in second same-process window does not steal authored target", () =>
                {
                    var hostHwnd = new IntPtr(focusedHostWindow.Current.NativeWindowHandle);
                    ShowWindow(focusedSecondHwnd, SwRestore);
                    SetForegroundWindow(hostHwnd);
                    WaitUntil(() => GetForegroundWindow() == hostHwnd,
                        "Authored host did not regain foreground before focused T08 rediscovery.");

                    Invoke(FindByAutomationId(focusedRuntimeWindow, "FindElementButton"));
                    SetForegroundWindow(hostHwnd);
                    WaitUntil(() => IsOverlayAttached(runtime.Id, focusedAuthored),
                        "Same-process second-window duplicate stole the authored target.");
                });

                Console.WriteLine();
                Console.WriteLine($"Windows GUI sanity: {_passed} passed, {_failed} failed");
                return _failed == 0 ? 0 : 1;
            }

            if (selectedTests is not null && selectedTests.SetEquals(new[] { 20 }))
            {
                var focusedRuntimeWindow = WaitForWindow(runtime.Id, "GWTP Windows Runtime");
                Invoke(FindByName(focusedRuntimeWindow, "Open Ambiguity Test"));
                var authoredHost = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);
                PrepareHostTargetForPicker(focusedRuntimeWindow, authoredHost, automationId: "GroupA");
                var authoredTarget = FindTargetWithinGroup(authoredHost, "GroupA", "SharedContinue");
                SelectThroughRealPicker(focusedRuntimeWindow, authoredTarget);
                WaitUntil(() => IsOverlayAttached(runtime.Id, authoredTarget),
                    "Focused setup could not author the cross-launch target.");

                var authoredHwnd = new IntPtr(authoredHost.Current.NativeWindowHandle);
                SendMessage(authoredHwnd, WmClose, IntPtr.Zero, IntPtr.Zero);
                WaitUntil(() => TryFindTopLevelWindow("GWTP Windows UIA Test Host") is null,
                    "Focused setup host did not close.");
                Invoke(FindByName(focusedRuntimeWindow, "Open Ambiguity Test"));
                WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);

                Run("20. Cross-launch rediscovery finds authored target in a new process instance", () =>
            {
                // Own the complete cross-launch lifecycle inside T20. Earlier tests
                // deliberately mutate the selected descriptor and host lifecycle, so
                // borrowing their authored target makes this assertion order-dependent.
                var authoredHost = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);
                PrepareHostTargetForPicker(runtimeWindow, authoredHost, automationId: "GroupA");
                var authoredTarget = FindTargetWithinGroup(authoredHost, "GroupA", "SharedContinue");
                SelectThroughRealPicker(runtimeWindow, authoredTarget);
                WaitUntil(() => IsOverlayAttached(runtime.Id, authoredTarget),
                    "T20 could not author its cross-launch target.",
                    LaunchTimeoutMs);

                var authoredHwnd = new IntPtr(authoredHost.Current.NativeWindowHandle);
                SendMessage(authoredHwnd, WmClose, IntPtr.Zero, IntPtr.Zero);
                WaitUntil(() => Process.GetProcessesByName("GWTP.Windows.TestHost").Length == 0,
                    "Authored T20 test-host process did not fully exit.",
                    LaunchTimeoutMs);
                WaitUntil(() => TryFindRuntimeWindow(runtime.Id, "GWTP Guidance") is null &&
                                TryFindRuntimeWindow(runtime.Id, "GWTP Highlight") is null,
                    "T20 overlays remained after the authored host closed.");

                Invoke(FindByName(runtimeWindow, "Open Ambiguity Test"));
                WaitUntil(() => Process.GetProcessesByName("GWTP.Windows.TestHost").Length == 1,
                    "Replacement T20 test-host process did not start.",
                    LaunchTimeoutMs);
                var reopenedHost = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);
                PrepareHostTargetForPicker(runtimeWindow, reopenedHost, automationId: "GroupA");
                var reopenedTarget = FindTargetWithinGroup(reopenedHost, "GroupA", "SharedContinue");
                var reopenedHwnd = new IntPtr(reopenedHost.Current.NativeWindowHandle);

                SetForegroundWindow(reopenedHwnd);
                Invoke(FindByAutomationId(runtimeWindow, "FindElementButton"));
                SetForegroundWindow(reopenedHwnd);
                WaitUntil(() => IsOverlayAttached(runtime.Id, reopenedTarget),
                    "Authored target was not rediscovered after the target application restarted.",
                    LaunchTimeoutMs);
            });

            Run("21. Two identical app instances fail safely instead of choosing an arbitrary target", () =>
            {
                var firstHost = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);
                using var secondInstance = Process.Start(new ProcessStartInfo(hostExe) { UseShellExecute = true });
                Require(secondInstance is not null, "Could not start second identical test-host instance.");
                WaitForWindow(secondInstance!.Id, "GWTP Windows UIA Test Host");

                Invoke(FindByAutomationId(runtimeWindow, "FindElementButton"));
                WaitUntil(() => TryFindRuntimeWindow(runtime.Id, "GWTP Guidance") is null &&
                                TryFindRuntimeWindow(runtime.Id, "GWTP Highlight") is null,
                    "Runtime chose an arbitrary target while two indistinguishable app instances were available.");

                secondInstance.Kill(true);
                secondInstance.WaitForExit(LaunchTimeoutMs);
                var firstHwnd = new IntPtr(firstHost.Current.NativeWindowHandle);
                SetForegroundWindow(firstHwnd);
                Invoke(FindByAutomationId(runtimeWindow, "FindElementButton"));
                SetForegroundWindow(firstHwnd);
                var firstTarget = FindTargetWithinGroup(firstHost, "GroupA", "SharedContinue");
                WaitUntil(() => IsOverlayAttached(runtime.Id, firstTarget),
                    "Runtime did not recover after the ambiguous second instance closed.");
            });

            Run("22. Production Native Preview transfers foreground between Windows targets", () =>
            {
                var firstHost = WaitForTopLevelWindow("GWTP Windows UIA Test Host", LaunchTimeoutMs);
                Invoke(FindByName(firstHost, "Open second test window"));
                var secondHost = WaitForTopLevelWindow("GWTP UIA Test Host — Second Window", LaunchTimeoutMs);

                var firstTarget = FindByAutomationId(firstHost, "StableTextBox");
                var secondTarget = FindByAutomationId(secondHost, "SameProcessTarget");
                var firstHwnd = new IntPtr(firstHost.Current.NativeWindowHandle);
                var secondHwnd = new IntPtr(secondHost.Current.NativeWindowHandle);
                var runtimeHwnd = new IntPtr(runtimeWindow.Current.NativeWindowHandle);

                SetForegroundWindow(runtimeHwnd);
                WaitUntil(() => GetForegroundWindow() == runtimeHwnd,
                    "Could not establish the pre-Windows foreground owner.");

                using var native = StartNativeMessagingRuntime(runtimeExe);
                SendNativeMessage(native, BuildShowStepMessage(
                    "focus-a", "GWTP Windows UIA Test Host", firstTarget, canPrevious: false, canNext: true));
                Require(ReadNativeSuccess(native, "stepShown", "focus-a"),
                    "Native runtime could not show the first Windows target.");
                WaitUntil(() => GetForegroundWindow() == firstHwnd,
                    "Windows target A did not receive foreground on entry.");

                SendNativeMessage(native, BuildShowStepMessage(
                    "focus-b", "GWTP UIA Test Host — Second Window", secondTarget, canPrevious: true, canNext: true));
                Require(ReadNativeSuccess(native, "stepShown", "focus-b"),
                    "Native runtime could not show the second Windows target.");
                WaitUntil(() => GetForegroundWindow() == secondHwnd,
                    "Windows target B did not receive foreground on Next.");

                SendNativeMessage(native, BuildShowStepMessage(
                    "focus-a-return", "GWTP Windows UIA Test Host", firstTarget, canPrevious: false, canNext: true));
                Require(ReadNativeSuccess(native, "stepShown", "focus-a-return"),
                    "Native runtime could not return to the first Windows target.");
                WaitUntil(() => GetForegroundWindow() == firstHwnd,
                    "Windows target A did not regain foreground on Previous.");

                SendNativeMessage(native, new
                {
                    type = "clearStep",
                    requestId = "focus-web-return",
                    restorePreviousForeground = true
                });
                Require(ReadNativeSuccess(native, "stepCleared", "focus-web-return"),
                    "Native runtime could not clear the Windows step.");
                WaitUntil(() => GetForegroundWindow() == runtimeHwnd,
                    "Native Windows-to-Web handoff did not restore the pre-Windows foreground window.");

                native.StandardInput.Close();
                native.WaitForExit(LaunchTimeoutMs);
            });
        }
        finally
        {
            TryCloseProcessByName("GWTP.Windows.TestHost");
            if (!runtime.HasExited) runtime.Kill(true);
        }

        Console.WriteLine();
        Console.WriteLine($"Windows GUI sanity: {_passed} passed, {_failed} failed");
        return _failed == 0 ? 0 : 1;
    }


    private static Process StartNativeMessagingRuntime(string runtimeExe)
    {
        var process = Process.Start(new ProcessStartInfo(runtimeExe, "chrome-extension://gwtp-gui-tests/")
        {
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        });
        Require(process is not null, "Could not start Native Messaging runtime.");
        return process!;
    }

    private static object BuildShowStepMessage(
        string requestId,
        string windowName,
        AutomationElement target,
        bool canPrevious,
        bool canNext)
        => new
        {
            type = "showStep",
            requestId,
            target = new
            {
                processName = "GWTP.Windows.TestHost",
                window = new { automationId = (string?)null, name = windowName },
                element = new
                {
                    controlType = target.Current.ControlType.ProgrammaticName,
                    automationId = target.Current.AutomationId,
                    name = target.Current.Name
                },
                ancestors = Array.Empty<object>()
            },
            instruction = $"GUI focus test {requestId}",
            canPrevious,
            canNext
        };

    private static void SendNativeMessage(Process process, object message)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(message);
        Span<byte> prefix = stackalloc byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(prefix, payload.Length);
        process.StandardInput.BaseStream.Write(prefix);
        process.StandardInput.BaseStream.Write(payload);
        process.StandardInput.BaseStream.Flush();
    }

    private static bool ReadNativeSuccess(Process process, string expectedType, string requestId)
    {
        var prefix = new byte[4];
        ReadExactly(process.StandardOutput.BaseStream, prefix);
        var length = BinaryPrimitives.ReadInt32LittleEndian(prefix);
        Require(length > 0 && length <= 1024 * 1024, $"Invalid Native Messaging response length: {length}.");
        var payload = new byte[length];
        ReadExactly(process.StandardOutput.BaseStream, payload);
        using var json = JsonDocument.Parse(payload);
        var root = json.RootElement;
        return root.TryGetProperty("type", out var type) &&
               type.GetString() == expectedType &&
               root.TryGetProperty("requestId", out var id) &&
               id.GetString() == requestId &&
               root.TryGetProperty("success", out var success) &&
               success.ValueKind == JsonValueKind.True;
    }

    private static void ReadExactly(Stream stream, byte[] buffer)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = stream.Read(buffer, offset, buffer.Length - offset);
            if (read <= 0) throw new EndOfStreamException("Native Messaging runtime closed before replying.");
            offset += read;
        }
    }

    private static List<AutomationElement> FindAllByAutomationId(AutomationElement root, string id)
        => root.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, id))
            .Cast<AutomationElement>().ToList();

    private static void SelectThroughRealPicker(AutomationElement runtimeWindow, AutomationElement target)
    {
        Invoke(FindByAutomationId(runtimeWindow, "SelectElementButton"));
        WaitUntil(() => FindByAutomationId(runtimeWindow, "SelectElementButton").Current.Name == "Cancel",
            "Picker did not enter selection mode.");
        Thread.Sleep(VisualPickerPauseMs);

        var hostHwnd = GetAncestorWindowFromElement(target);
        Require(hostHwnd != IntPtr.Zero, "Could not resolve target host window.");
        // Do not fight Windows foreground-lock. Instead make the target host
        // physically topmost for the click and prove that UIA FromPoint resolves
        // the intended authored element before clicking it.
        SetWindowPos(hostHwnd, HwndTop, 0, 0, 0, 0,
            SwpNomove | SwpNosize | SwpNoactivate);
        // Hide the runtime authoring window during the physical pick. This mirrors
        // the intended picker UX and prevents GWTP itself from obscuring the target.
        var runtimeHwnd = new IntPtr(runtimeWindow.Current.NativeWindowHandle);
        ShowWindow(runtimeHwnd, SwHide);

        var rect = target.Current.BoundingRectangle;
        var x = (int)Math.Round(rect.Left + rect.Width / 2);
        var y = (int)Math.Round(rect.Top + rect.Height / 2);
        Require(SetCursorPos(x, y), "Could not move cursor to target.");
        WaitUntil(() => IsCursorInside(rect), "Cursor did not reach target bounds.");
        Thread.Sleep(VisualPickerPauseMs);
        WaitUntil(() =>
        {
            var atPoint = AutomationElement.FromPoint(new System.Windows.Point(x, y));
            if (atPoint is null || atPoint.Current.ProcessId != target.Current.ProcessId)
            {
                return false;
            }

            // UIA FromPoint may legitimately return a child presentation element
            // inside the authored control. Accept the point when that element is
            // the target itself or descends from it.
            var current = atPoint;
            while (current is not null)
            {
                if (Automation.Compare(current, target))
                {
                    return true;
                }

                current = TreeWalker.ControlViewWalker.GetParent(current);
            }

            return false;
        }, "Intended picker target is obscured at click point.");
        mouse_event(MouseeventfLeftdown, 0, 0, 0, UIntPtr.Zero);

        // The production picker samples the global mouse state every 40 ms.
        // Keep the button down only until the picker itself reports completion;
        // do not use a fixed transition delay.
        WaitUntil(() =>
        {
            var button = FindByAutomationId(runtimeWindow, "SelectElementButton");
            return button.Current.Name == "Select Element" && button.Current.IsEnabled;
        }, "Picker did not complete selection.");

        mouse_event(MouseeventfLeftup, 0, 0, 0, UIntPtr.Zero);
        ShowWindow(runtimeHwnd, SwShowNoActivate);
        Thread.Sleep(VisualPickerPauseMs);

        // Do not let a failed/late synthetic click leak selection mode into the next test.
        mouse_event(MouseeventfLeftup, 0, 0, 0, UIntPtr.Zero);
    }

    private static AutomationElement WaitForRuntimeWindow(int processId, string name)
    {
        AutomationElement? found = null;
        WaitUntil(() => (found = TryFindRuntimeWindow(processId, name)) is not null,
            $"Runtime window '{name}' did not appear.");
        return found!;
    }

    private static AutomationElement? TryFindRuntimeWindow(int processId, string name)
        => AutomationElement.RootElement.FindFirst(TreeScope.Children,
            new AndCondition(
                new PropertyCondition(AutomationElement.ProcessIdProperty, processId),
                new PropertyCondition(AutomationElement.NameProperty, name)));

    private static AutomationElement? TryFindTopLevelWindow(string name)
        => AutomationElement.RootElement.FindFirst(TreeScope.Children,
            new PropertyCondition(AutomationElement.NameProperty, name));

    private static bool IsOverlayAttached(int runtimeProcessId, AutomationElement target)
    {
        try
        {
            var highlight = TryFindRuntimeWindow(runtimeProcessId, "GWTP Highlight");
            var guidance = TryFindRuntimeWindow(runtimeProcessId, "GWTP Guidance");
            if (highlight is null || guidance is null) return false;

            var targetRect = target.Current.BoundingRectangle;
            var highlightRect = highlight.Current.BoundingRectangle;
            var guidanceRect = guidance.Current.BoundingRectangle;

            var highlightMatches = Math.Abs(highlightRect.Left - targetRect.Left) <= 8 &&
                                   Math.Abs(highlightRect.Top - targetRect.Top) <= 8 &&
                                   Math.Abs(highlightRect.Width - targetRect.Width) <= 12 &&
                                   Math.Abs(highlightRect.Height - targetRect.Height) <= 12;

            var horizontalGap = Math.Max(0, Math.Max(targetRect.Left - guidanceRect.Right, guidanceRect.Left - targetRect.Right));
            var verticalGap = Math.Max(0, Math.Max(targetRect.Top - guidanceRect.Bottom, guidanceRect.Top - targetRect.Bottom));
            return highlightMatches && horizontalGap <= 40 && verticalGap <= 40;
        }
        catch (ElementNotAvailableException) { return false; }
    }

    private static void AssertOverlayAttached(int runtimeProcessId, AutomationElement target)
        => Require(IsOverlayAttached(runtimeProcessId, target), "Highlight/guidance are not attached to the selected target.");

    private static void ArrangeWindowsForPicker(AutomationElement runtimeWindow, AutomationElement hostWindow)
    {
        var work = Forms.Screen.PrimaryScreen.WorkingArea;
        var runtime = runtimeWindow.Current.BoundingRectangle;
        var host = hostWindow.Current.BoundingRectangle;

        var runtimeHwnd = new IntPtr(runtimeWindow.Current.NativeWindowHandle);
        var hostHwnd = new IntPtr(hostWindow.Current.NativeWindowHandle);

        // Put the runtime and authored target host in separate visible regions.
        // A real picker click cannot select a control that is physically covered by GWTP.
        var runtimeX = work.Left + 20;
        var runtimeY = work.Top + 20;
        Require(SetWindowPos(runtimeHwnd, IntPtr.Zero, runtimeX, runtimeY,
            (int)runtime.Width, (int)runtime.Height, SwpNozorder | SwpNoactivate),
            "Could not position runtime window.");

        var hostX = Math.Min(
            work.Right - (int)host.Width - 20,
            runtimeX + (int)runtime.Width + 40);
        var hostY = work.Top + 20;

        // If the screen is too narrow for side-by-side placement, put the host below.
        if (hostX < runtimeX + runtime.Width)
        {
            hostX = work.Left + 20;
            hostY = Math.Min(
                work.Bottom - (int)host.Height - 20,
                runtimeY + (int)runtime.Height + 40);
        }

        Require(SetWindowPos(hostHwnd, IntPtr.Zero, hostX, hostY,
            (int)host.Width, (int)host.Height, SwpNozorder | SwpNoactivate),
            "Could not position target host window.");
    }

    private static string BuildPickerGeometryDiagnostic(
        AutomationElement hostWindow,
        AutomationElement? target)
    {
        string RectText(System.Windows.Rect rect)
            => $"L={rect.Left:F1},T={rect.Top:F1},R={rect.Right:F1},B={rect.Bottom:F1},W={rect.Width:F1},H={rect.Height:F1}";

        var hostRect = hostWindow.Current.BoundingRectangle;
        var targetText = target is null
            ? "<not found>"
            : RectText(target.Current.BoundingRectangle);
        var groupAText = TryFindByAutomationId(hostWindow, "GroupA") is { } groupA
            ? RectText(groupA.Current.BoundingRectangle)
            : "<not found>";
        var sharedCount = FindAllByAutomationId(hostWindow, "SharedContinue").Count;
        var visualState = "<unavailable>";
        try
        {
            var pattern = (WindowPattern)hostWindow.GetCurrentPattern(WindowPattern.Pattern);
            visualState = pattern.Current.WindowVisualState.ToString();
        }
        catch { }

        var screens = string.Join(" | ", Forms.Screen.AllScreens.Select((screen, index) =>
            $"Screen{index}[Bounds={screen.Bounds}; WorkingArea={screen.WorkingArea}; Primary={screen.Primary}]"));

        var cursor = GetCursorPos(out var point)
            ? $"X={point.X},Y={point.Y}"
            : "<unavailable>";

        return $"Authored target did not reach a physically accessible picker position. " +
               $"Host={RectText(hostRect)}; HostState={visualState}; GroupA={groupAText}; SharedContinueCount={sharedCount}; Target={targetText}; " +
               $"Cursor={cursor}; Screens={screens}";
    }

    private static bool IsCursorInside(System.Windows.Rect rect)
    {
        if (!GetCursorPos(out var point)) return false;
        return point.X >= rect.Left && point.X <= rect.Right &&
               point.Y >= rect.Top && point.Y <= rect.Bottom;
    }

    private static IntPtr GetAncestorWindowFromElement(AutomationElement element)
    {
        try
        {
            var current = element;
            while (current is not null)
            {
                var hwnd = new IntPtr(current.Current.NativeWindowHandle);
                if (hwnd != IntPtr.Zero) return GetAncestor(hwnd, GaRoot);
                current = TreeWalker.ControlViewWalker.GetParent(current);
            }
        }
        catch (ElementNotAvailableException) { }
        return IntPtr.Zero;
    }

    private static void MoveWindow(AutomationElement window, int dx, int dy)
    {
        var hwnd = new IntPtr(window.Current.NativeWindowHandle);
        var rect = window.Current.BoundingRectangle;
        Require(SetWindowPos(hwnd, IntPtr.Zero, (int)rect.Left + dx, (int)rect.Top + dy,
            (int)rect.Width, (int)rect.Height, SwpNozorder | SwpNoactivate), "Could not move host window.");
    }

    private static HashSet<int>? ParseSelectedTests(string[] args)
    {
        if (args.Length == 0) return null;

        var selected = new HashSet<int>();
        foreach (var arg in args)
        {
            foreach (var part in arg.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!int.TryParse(part, out var number) || number < 1 || number > 21)
                {
                    throw new ArgumentException($"Invalid test number '{part}'. Expected 1-21.");
                }
                selected.Add(number);
            }
        }
        return selected;
    }

    private static void Run(string name, Action test)
    {
        try
        {
            test();
            Thread.Sleep(HumanStepPauseMs);
            _passed++;
            WriteResult("PASS", name, ConsoleColor.Green);
        }
        catch (Exception ex)
        {
            _failed++;
            WriteResult("FAIL", $"{name} — {ex.Message}", ConsoleColor.Red);
        }
    }

    private static void WriteResult(string status, string message, ConsoleColor color)
    {
        var previous = Console.ForegroundColor;
        Console.ForegroundColor = color;
        Console.Write(status);
        Console.ForegroundColor = previous;
        Console.WriteLine($"  {message}");
    }

    private static AutomationElement WaitForWindow(int processId, string name)
    {
        AutomationElement? found = null;
        WaitUntil(() =>
        {
            found = AutomationElement.RootElement.FindFirst(TreeScope.Children,
                new AndCondition(
                    new PropertyCondition(AutomationElement.ProcessIdProperty, processId),
                    new PropertyCondition(AutomationElement.NameProperty, name)));
            return found is not null;
        }, $"Window '{name}' did not appear.");
        return found!;
    }

    private static AutomationElement WaitForTopLevelWindow(string name, int timeoutMs = TimeoutMs)
    {
        AutomationElement? found = null;
        WaitUntil(() =>
        {
            found = AutomationElement.RootElement.FindFirst(TreeScope.Children,
                new PropertyCondition(AutomationElement.NameProperty, name));
            return found is not null;
        }, $"Window '{name}' did not appear.", timeoutMs);
        return found!;
    }

    private static AutomationElement FindByName(AutomationElement root, string name)
        => TryFindByName(root, name) ?? throw new InvalidOperationException($"GUI element '{name}' not found.");

    private static AutomationElement? TryFindByName(AutomationElement root, string name)
        => root.FindFirst(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.NameProperty, name));

    private static AutomationElement FindByAutomationId(AutomationElement root, string id)
        => TryFindByAutomationId(root, id) ?? throw new InvalidOperationException($"GUI element '{id}' not found.");

    private static AutomationElement? TryFindByAutomationId(AutomationElement root, string id)
        => root.FindFirst(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.AutomationIdProperty, id));

    private static void PrepareHostTargetForPicker(
        AutomationElement runtimeWindow,
        AutomationElement hostWindow,
        string? name = null,
        string? automationId = null)
    {
        var hostHwnd = new IntPtr(hostWindow.Current.NativeWindowHandle);
        ShowWindow(hostHwnd, SwRestore);
        ArrangeWindowsForPicker(runtimeWindow, hostWindow);

        var scenarioScroll = TryFindByAutomationId(hostWindow, "ScenarioScrollViewer");
        if (scenarioScroll is not null &&
            scenarioScroll.TryGetCurrentPattern(ScrollPattern.Pattern, out var scrollObject) &&
            scrollObject is ScrollPattern scroll &&
            scroll.Current.VerticallyScrollable)
        {
            AutomationElement? target = automationId is not null
                ? TryFindByAutomationId(hostWindow, automationId)
                : name is not null ? TryFindByName(hostWindow, name) : null;

            if (target is not null &&
                target.TryGetCurrentPattern(ScrollItemPattern.Pattern, out var itemObject) &&
                itemObject is ScrollItemPattern item)
            {
                item.ScrollIntoView();
            }

            // WPF controls inside this ScrollViewer do not consistently expose
            // ScrollItemPattern. If the requested target is still clipped, use the
            // public ScrollPattern to move through the viewport until its UIA bounds
            // become physically reachable by the real picker.
            if (target is not null)
            {
                for (var percent = 0.0; percent <= 100.0; percent += 10.0)
                {
                    var rect = target.Current.BoundingRectangle;
                    var center = new System.Drawing.Point(
                        (int)Math.Round(rect.Left + rect.Width / 2),
                        (int)Math.Round(rect.Top + rect.Height / 2));
                    if (!rect.IsEmpty && rect.Width > 0 && rect.Height > 0 &&
                        IsPointInsideHostClientArea(hostHwnd, center))
                    {
                        break;
                    }

                    scroll.SetScrollPercent(ScrollPattern.NoScroll, percent);
                }
            }
        }

        SetForegroundWindow(hostHwnd);
    }

    private static bool IsPointInsideHostClientArea(IntPtr hwnd, System.Drawing.Point point)
    {
        if (!GetClientRect(hwnd, out var client)) return false;
        var topLeft = new NativePoint { X = client.Left, Y = client.Top };
        var bottomRight = new NativePoint { X = client.Right, Y = client.Bottom };
        if (!ClientToScreen(hwnd, ref topLeft) || !ClientToScreen(hwnd, ref bottomRight)) return false;
        return point.X >= topLeft.X && point.X < bottomRight.X &&
               point.Y >= topLeft.Y && point.Y < bottomRight.Y;
    }

    private static AutomationElement FindTargetWithinGroup(
        AutomationElement window,
        string groupAutomationId,
        string targetAutomationId)
    {
        var group = FindByAutomationId(window, groupAutomationId);
        if (group.TryGetCurrentPattern(ScrollItemPattern.Pattern, out var groupScrollObject) &&
            groupScrollObject is ScrollItemPattern groupScroll)
        {
            groupScroll.ScrollIntoView();
        }

        var groupRect = group.Current.BoundingRectangle;
        return FindAllByAutomationId(window, targetAutomationId)
            .FirstOrDefault(candidate =>
            {
                var rect = candidate.Current.BoundingRectangle;
                if (rect.IsEmpty || rect.Width <= 0 || rect.Height <= 0) return false;
                var centerX = rect.Left + rect.Width / 2;
                return centerX >= groupRect.Left && centerX <= groupRect.Right;
            })
            ?? throw new InvalidOperationException(
                $"Target '{targetAutomationId}' was not found inside group '{groupAutomationId}'.");
    }

    private static void Invoke(AutomationElement element)
    {
        if (!element.TryGetCurrentPattern(InvokePattern.Pattern, out var pattern) || pattern is not InvokePattern invoke)
            throw new InvalidOperationException($"'{element.Current.Name}' does not expose InvokePattern.");
        invoke.Invoke();
    }

    private static void WaitUntil(Func<bool> condition, string error, int timeoutMs = TimeoutMs)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            try { if (condition()) return; } catch (ElementNotAvailableException) { }
            Thread.Sleep(10);
        }
        throw new TimeoutException(error);
    }

    private static void Require(bool condition, string error)
    {
        if (!condition) throw new InvalidOperationException(error);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "windows-runtime", "GWTP.Windows.Runtime")) && Directory.Exists(Path.Combine(dir.FullName, "tests", "windows", "GWTP.Windows.GuiTests"))) return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }


    private const int VkLbutton = 0x01;
    private const uint MouseeventfLeftdown = 0x0002;
    private const uint MouseeventfLeftup = 0x0004;
    private const int SwHide = 0;
    private const int SwShowNoActivate = 4;
    private const int SwMinimize = 6;
    private const int SwRestore = 9;
    private static readonly IntPtr HwndTop = IntPtr.Zero;
    private const uint SwpNozorder = 0x0004;
    private const uint SwpNosize = 0x0001;
    private const uint SwpNomove = 0x0002;
    private const uint SwpNoactivate = 0x0010;
    private const uint WmClose = 0x0010;
    private const uint GaRoot = 2;

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hwnd, out NativeRect rect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hwnd, ref NativePoint point);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport("user32.dll")]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out NativePoint point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hwnd, int command);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    private static void TryCloseProcessByName(string name)
    {
        foreach (var process in Process.GetProcessesByName(name))
        {
            using (process)
            {
                try { process.Kill(true); } catch { }
            }
        }
    }
}
