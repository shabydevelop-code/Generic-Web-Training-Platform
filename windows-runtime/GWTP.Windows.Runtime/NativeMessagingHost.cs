using System.Buffers.Binary;
using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;

namespace GWTP_Windows_POC;

internal sealed class NativeMessagingHost : IDisposable
{
    private readonly MainWindow _pickerWindow;
    private readonly Stream _input;
    private readonly Stream _output;
    private readonly CancellationTokenSource _cts = new();
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private bool _disposed;
    private string? _pendingRequestId;

    public NativeMessagingHost(MainWindow pickerWindow)
    {
        _pickerWindow = pickerWindow;
        _input = OpenStandardHandle(STD_INPUT_HANDLE, FileAccess.Read);
        _output = OpenStandardHandle(STD_OUTPUT_HANDLE, FileAccess.Write);
        _pickerWindow.AuthoringTargetSelected += OnAuthoringTargetSelected;
        _pickerWindow.AuthoringSelectionCancelled += OnAuthoringSelectionCancelled;
    }

    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;

    private static FileStream OpenStandardHandle(int handleId, FileAccess access)
    {
        var handle = GetStdHandle(handleId);
        if (handle == IntPtr.Zero || handle == new IntPtr(-1))
            throw new InvalidOperationException($"Native messaging standard handle {handleId} is unavailable.");

        var safeHandle = new SafeFileHandle(handle, ownsHandle: false);
        return new FileStream(safeHandle, access, bufferSize: 4096, isAsync: true);
    }

    public async Task RunAsync()
    {
        while (!_cts.IsCancellationRequested)
        {
            var message = await ReadMessageAsync(_cts.Token);
            if (message is null) break;

            if (!message.RootElement.TryGetProperty("type", out var typeElement))
                continue;

            var type = typeElement.GetString();
            var requestId = message.RootElement.TryGetProperty("requestId", out var requestElement)
                ? requestElement.GetString()
                : null;

            if (type == "ping")
            {
                await WriteMessageAsync(new { type = "pong", requestId });
                continue;
            }

            if (type == "pickTarget")
            {
                if (_pendingRequestId is not null)
                {
                    await WriteMessageAsync(new { type = "error", requestId, code = "selection-in-progress" });
                    continue;
                }

                _pendingRequestId = requestId ?? Guid.NewGuid().ToString("N");
                await _pickerWindow.Dispatcher.InvokeAsync(() => _pickerWindow.BeginAuthoringSelection());
                continue;
            }

            if (type == "cancelPick")
            {
                await _pickerWindow.Dispatcher.InvokeAsync(() => _pickerWindow.CancelAuthoringSelection());
            }
        }
    }

    private async void OnAuthoringTargetSelected(WindowsTargetDescriptor descriptor)
    {
        var requestId = _pendingRequestId;
        _pendingRequestId = null;
        if (requestId is null) return;

        try
        {
            await WriteMessageAsync(new { type = "targetSelected", requestId, target = descriptor });
        }
        catch (Exception ex)
        {
            DiagnosticLog.Write("NativeMessaging.WriteTargetFailed", ex);
        }
    }

    private async void OnAuthoringSelectionCancelled()
    {
        var requestId = _pendingRequestId;
        _pendingRequestId = null;
        if (requestId is null) return;

        try
        {
            await WriteMessageAsync(new { type = "selectionCancelled", requestId });
        }
        catch (Exception ex)
        {
            DiagnosticLog.Write("NativeMessaging.WriteCancelFailed", ex);
        }
    }

    private async Task<JsonDocument?> ReadMessageAsync(CancellationToken cancellationToken)
    {
        var lengthBytes = new byte[4];
        if (!await ReadExactlyOrEofAsync(_input, lengthBytes, cancellationToken)) return null;

        var length = BinaryPrimitives.ReadInt32LittleEndian(lengthBytes);
        if (length <= 0 || length > 1024 * 1024)
            throw new InvalidDataException("Invalid native messaging message length.");

        var payload = new byte[length];
        if (!await ReadExactlyOrEofAsync(_input, payload, cancellationToken))
            throw new EndOfStreamException();

        return JsonDocument.Parse(payload);
    }

    private async Task WriteMessageAsync(object value)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(value, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        var lengthBytes = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(lengthBytes, payload.Length);

        await _writeLock.WaitAsync();
        try
        {
            await _output.WriteAsync(lengthBytes);
            await _output.WriteAsync(payload);
            await _output.FlushAsync();
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private static async Task<bool> ReadExactlyOrEofAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset), cancellationToken);
            if (read == 0) return offset == 0;
            offset += read;
        }
        return true;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _pickerWindow.AuthoringTargetSelected -= OnAuthoringTargetSelected;
        _pickerWindow.AuthoringSelectionCancelled -= OnAuthoringSelectionCancelled;
        _cts.Dispose();
        _writeLock.Dispose();
        _input.Dispose();
        _output.Dispose();
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);
}
