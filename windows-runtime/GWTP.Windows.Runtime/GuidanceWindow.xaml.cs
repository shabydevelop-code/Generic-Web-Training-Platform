using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Input;
using Forms = System.Windows.Forms;

namespace GWTP_Windows_POC;

public partial class GuidanceWindow : Window
{
    private const int GwlExStyle = -20;
    private const int WsExToolWindow = 0x00000080;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;
    private static readonly IntPtr HwndTopmost = new(-1);

    private IntPtr _handle;
    private bool _manualPosition;

    public event Action? PreviousRequested;
    public event Action? NextRequested;

    public GuidanceWindow()
    {
        InitializeComponent();
        SourceInitialized += GuidanceWindow_SourceInitialized;
    }

    public void ShowNear(Rect targetBounds)
    {
        if (_manualPosition && IsVisible)
        {
            return;
        }

        if (!IsVisible)
        {
            Show();
            UpdateLayout();
        }

        if (_handle == IntPtr.Zero)
        {
            _handle = new WindowInteropHelper(this).Handle;
        }

        var screen = Forms.Screen.FromPoint(
            new System.Drawing.Point(
                (int)Math.Round(targetBounds.Left + (targetBounds.Width / 2)),
                (int)Math.Round(targetBounds.Top + (targetBounds.Height / 2))));

        var workArea = screen.WorkingArea;
        var width = Math.Max(ActualWidth, 340);
        var height = Math.Max(ActualHeight, 130);
        const int gap = 12;

        var x = targetBounds.Left + ((targetBounds.Width - width) / 2);
        var yBelow = targetBounds.Bottom + gap;
        var yAbove = targetBounds.Top - height - gap;
        var y = yBelow + height <= workArea.Bottom ? yBelow : yAbove;

        x = Math.Max(workArea.Left + gap, Math.Min(x, workArea.Right - width - gap));
        y = Math.Max(workArea.Top + gap, Math.Min(y, workArea.Bottom - height - gap));

        SetWindowPos(
            _handle,
            HwndTopmost,
            (int)Math.Round(x),
            (int)Math.Round(y),
            (int)Math.Round(width),
            (int)Math.Round(height),
            SwpNoActivate | SwpShowWindow);
    }

    public void SetDirection(bool rtl)
    {
        var flowDirection = rtl ? System.Windows.FlowDirection.RightToLeft : System.Windows.FlowDirection.LeftToRight;
        var textAlignment = rtl ? TextAlignment.Right : TextAlignment.Left;

        StepPositionText.FlowDirection = flowDirection;
        InstructionText.FlowDirection = flowDirection;
        ValidationMessage.FlowDirection = flowDirection;

        // Keep the physical layout fixed and move the text block itself to the
        // requested edge. This avoids relying on WPF TextAlignment inside a
        // bidi-inherited StackPanel.
        ContentPanel.FlowDirection = System.Windows.FlowDirection.LeftToRight;
        ContentStack.FlowDirection = System.Windows.FlowDirection.LeftToRight;
        StepPositionRow.FlowDirection = System.Windows.FlowDirection.LeftToRight;
        InstructionRow.FlowDirection = System.Windows.FlowDirection.LeftToRight;
        ValidationRow.FlowDirection = System.Windows.FlowDirection.LeftToRight;

        var physicalAlignment = rtl
            ? System.Windows.HorizontalAlignment.Right
            : System.Windows.HorizontalAlignment.Left;

        StepPositionText.Width = double.NaN;
        InstructionText.Width = double.NaN;
        ValidationMessage.Width = double.NaN;
        StepPositionText.MaxWidth = 308;
        InstructionText.MaxWidth = 308;
        ValidationMessage.MaxWidth = 308;
        StepPositionText.HorizontalAlignment = physicalAlignment;
        InstructionText.HorizontalAlignment = physicalAlignment;
        ValidationMessage.HorizontalAlignment = physicalAlignment;
        StepPositionText.TextAlignment = textAlignment;
        InstructionText.TextAlignment = textAlignment;
        ValidationMessage.TextAlignment = textAlignment;

        PreviousButton.FlowDirection = flowDirection;
        NextButton.FlowDirection = flowDirection;
    }

    public void SetStepPosition(int stepIndex, int totalSteps, string? template)
    {
        var safeTotal = Math.Max(1, totalSteps);
        var safeCurrent = Math.Clamp(stepIndex + 1, 1, safeTotal);
        var format = string.IsNullOrWhiteSpace(template) ? "Step {current} of {total}" : template;
        StepPositionText.Text = format
            .Replace("{current}", safeCurrent.ToString())
            .Replace("{total}", safeTotal.ToString());
    }

    public void SetInstruction(string? instruction)
    {
        InstructionText.Text = string.IsNullOrWhiteSpace(instruction)
            ? "Follow the highlighted step."
            : instruction;
    }

    public void SetValidationMessage(string? message)
    {
        ValidationMessage.Text = message ?? string.Empty;
        ValidationMessage.Visibility = string.IsNullOrWhiteSpace(message) ? Visibility.Collapsed : Visibility.Visible;
    }

    public void SetNavigationState(bool canPrevious, bool canNext, bool isLastStep = false, string? previousLabel = null, string? nextLabel = null, string? finishLabel = null)
    {
        PreviousButton.IsEnabled = canPrevious;
        PreviousButton.Content = string.IsNullOrWhiteSpace(previousLabel) ? "Previous" : previousLabel;
        NextButton.IsEnabled = isLastStep || canNext;
        NextButton.Content = isLastStep
            ? (string.IsNullOrWhiteSpace(finishLabel) ? "Finish" : finishLabel)
            : (string.IsNullOrWhiteSpace(nextLabel) ? "Next" : nextLabel);
    }

    private void PreviousButton_Click(object sender, RoutedEventArgs e) => PreviousRequested?.Invoke();

    private void NextButton_Click(object sender, RoutedEventArgs e) => NextRequested?.Invoke();

    public void ResetManualPosition()
    {
        _manualPosition = false;
    }

    private void DragHandle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left)
        {
            return;
        }

        _manualPosition = true;
        try
        {
            DragMove();
        }
        catch (InvalidOperationException)
        {
            _manualPosition = false;
        }
    }

    private void GuidanceWindow_SourceInitialized(object? sender, EventArgs e)
    {
        _handle = new WindowInteropHelper(this).Handle;
        var style = GetWindowLongPtr(_handle, GwlExStyle).ToInt64();
        style |= WsExToolWindow;
        SetWindowLongPtr(_handle, GwlExStyle, new IntPtr(style));
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(
        IntPtr windowHandle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr windowHandle, int index);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern IntPtr GetWindowLong32(IntPtr windowHandle, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr windowHandle, int index, IntPtr newLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern IntPtr SetWindowLong32(IntPtr windowHandle, int index, IntPtr newLong);

    private static IntPtr GetWindowLongPtr(IntPtr windowHandle, int index)
        => IntPtr.Size == 8 ? GetWindowLongPtr64(windowHandle, index) : GetWindowLong32(windowHandle, index);

    private static IntPtr SetWindowLongPtr(IntPtr windowHandle, int index, IntPtr newLong)
        => IntPtr.Size == 8 ? SetWindowLongPtr64(windowHandle, index, newLong) : SetWindowLong32(windowHandle, index, newLong);
}
