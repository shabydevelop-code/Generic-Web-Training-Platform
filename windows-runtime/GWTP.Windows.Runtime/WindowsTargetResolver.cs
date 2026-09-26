using System.Diagnostics;
using System.Windows.Automation;

namespace GWTP_Windows_POC;

internal static class WindowsTargetResolver
{
    public static AutomationElement? Resolve(WindowsTargetDescriptor target)
    {
        var sessionId = Process.GetCurrentProcess().SessionId;
        var processIds = Process.GetProcessesByName(target.ProcessName)
            .Where(p => TryGetSessionId(p, out var id) && id == sessionId)
            .Select(p => { var id = p.Id; p.Dispose(); return id; })
            .ToHashSet();

        if (processIds.Count == 0) return null;

        var windows = AutomationElement.RootElement.FindAll(
            TreeScope.Children,
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window));

        var candidates = new List<AutomationElement>();
        foreach (AutomationElement window in windows)
        {
            try
            {
                if (!processIds.Contains(window.Current.ProcessId) || !MatchesWindow(window, target.Window)) continue;
                if (MatchesElement(window, target.Element)) candidates.Add(window);

                foreach (AutomationElement element in window.FindAll(TreeScope.Descendants, Condition.TrueCondition))
                {
                    if (MatchesElement(element, target.Element)) candidates.Add(element);
                }
            }
            catch (ElementNotAvailableException) { }
        }

        if (candidates.Count == 1) return candidates[0];
        if (candidates.Count == 0) return null;

        for (var count = 1; count <= target.Ancestors.Count; count++)
        {
            var narrowed = candidates
                .Where(candidate => MatchesAncestorPath(candidate, target.Ancestors, count))
                .ToList();
            if (narrowed.Count == 1) return narrowed[0];
            if (narrowed.Count == 0) return null;
            candidates = narrowed;
        }

        return null;
    }

    private static bool TryGetSessionId(Process process, out int sessionId)
    {
        try { sessionId = process.SessionId; return true; }
        catch { process.Dispose(); sessionId = -1; return false; }
    }

    private static bool MatchesWindow(AutomationElement window, WindowsWindowDescriptor descriptor)
    {
        if (!string.IsNullOrWhiteSpace(descriptor.AutomationId))
            return string.Equals(window.Current.AutomationId, descriptor.AutomationId, StringComparison.Ordinal);
        if (!string.IsNullOrWhiteSpace(descriptor.Name))
            return string.Equals(window.Current.Name, descriptor.Name, StringComparison.Ordinal);
        return true;
    }

    private static bool MatchesElement(AutomationElement element, WindowsElementDescriptor descriptor)
    {
        try
        {
            if (!string.Equals(element.Current.ControlType?.ProgrammaticName, descriptor.ControlType, StringComparison.Ordinal))
                return false;
            if (!string.IsNullOrWhiteSpace(descriptor.AutomationId))
                return string.Equals(element.Current.AutomationId, descriptor.AutomationId, StringComparison.Ordinal);
            return !string.IsNullOrWhiteSpace(descriptor.Name) &&
                   string.Equals(element.Current.Name, descriptor.Name, StringComparison.Ordinal);
        }
        catch (ElementNotAvailableException) { return false; }
    }

    private static bool MatchesAncestorPath(
        AutomationElement element,
        IReadOnlyList<WindowsAncestorDescriptor> authored,
        int count)
    {
        var actual = new List<WindowsAncestorDescriptor>();
        var walker = TreeWalker.ControlViewWalker;
        AutomationElement? current;
        try { current = walker.GetParent(element); }
        catch (ElementNotAvailableException) { return false; }

        for (var depth = 0; current is not null && depth < 32 && actual.Count < count; depth++)
        {
            try
            {
                if (current.Current.ControlType == ControlType.Window) break;
                var automationId = BlankToNull(current.Current.AutomationId);
                var name = BlankToNull(current.Current.Name);
                if (automationId is not null || name is not null)
                {
                    actual.Add(new WindowsAncestorDescriptor(
                        current.Current.ControlType?.ProgrammaticName ?? "ControlType.Custom",
                        automationId,
                        name));
                }
                current = walker.GetParent(current);
            }
            catch (ElementNotAvailableException) { return false; }
        }

        if (actual.Count < count) return false;
        for (var i = 0; i < count; i++)
        {
            if (!MatchesDescriptor(actual[i], authored[i])) return false;
        }
        return true;
    }

    private static bool MatchesDescriptor(WindowsAncestorDescriptor actual, WindowsAncestorDescriptor authored)
    {
        if (!string.Equals(actual.ControlType, authored.ControlType, StringComparison.Ordinal)) return false;
        if (!string.IsNullOrWhiteSpace(authored.AutomationId))
            return string.Equals(actual.AutomationId, authored.AutomationId, StringComparison.Ordinal);
        return !string.IsNullOrWhiteSpace(authored.Name) &&
               string.Equals(actual.Name, authored.Name, StringComparison.Ordinal);
    }

    private static string? BlankToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
