$ErrorActionPreference = 'Stop'

$null = Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class BrowserAppNativeWindow {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder value, int max);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder value, int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW", SetLastError=true)] public static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int index, IntPtr value);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hWnd);

    public static IntPtr FindFirefoxWindow(int targetPid) {
        IntPtr best = IntPtr.Zero;
        long bestArea = -1;
        EnumWindows((hWnd, state) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid != (uint)targetPid || !IsWindowVisible(hWnd)) return true;
            var cls = new StringBuilder(256);
            GetClassName(hWnd, cls, cls.Capacity);
            if (!String.Equals(cls.ToString(), "MozillaWindowClass", StringComparison.OrdinalIgnoreCase)) return true;
            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) return true;
            long area = Math.Max(0, rect.Right - rect.Left) * (long)Math.Max(0, rect.Bottom - rect.Top);
            if (area > bestArea) { best = hWnd; bestArea = area; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    public static bool Resize(IntPtr hWnd, int x, int y, int width, int height) {
        return SetWindowPos(hWnd, IntPtr.Zero, x, y, Math.Max(1, width), Math.Max(1, height), 0x0004 | 0x0020 | 0x0040);
    }
}
'@

$script:attachedHandle = [IntPtr]::Zero
$script:originalParent = [IntPtr]::Zero
$script:originalStyle = [IntPtr]::Zero

function Convert-Handle([string]$value) {
    $number = [Convert]::ToInt64($value, 16)
    return [IntPtr]::new($number)
}

function Invoke-Operation($request) {
    switch ($request.operation) {
        'attach' {
            $child = [BrowserAppNativeWindow]::FindFirefoxWindow([int]$request.processId)
            if ($child -eq [IntPtr]::Zero) { throw 'Could not find the visible Firefox top-level window for the managed process.' }
            $parent = Convert-Handle ([string]$request.parentHandle)
            $script:originalParent = [BrowserAppNativeWindow]::GetParent($child)
            $script:originalStyle = [BrowserAppNativeWindow]::GetWindowLongPtr($child, -16)
            $style = [long]$script:originalStyle.ToInt64()
            $style = ($style -band (-bnot [long]0x80000000)) -bor [long]0x40000000
            $style = $style -band (-bnot [long]0x00CF0000)
            $style = $style -band (-bnot [long]0x00040000)
            $null = [BrowserAppNativeWindow]::SetWindowLongPtr($child, -16, [IntPtr]::new($style))
            $null = [BrowserAppNativeWindow]::SetParent($child, $parent)
            if ([BrowserAppNativeWindow]::GetParent($child) -ne $parent) {
                $null = [BrowserAppNativeWindow]::SetWindowLongPtr($child, -16, $script:originalStyle)
                throw 'Windows rejected SetParent while embedding Firefox.'
            }
            $script:attachedHandle = $child
            $b = $request.bounds
            if (-not [BrowserAppNativeWindow]::Resize($child, [int]$b.x, [int]$b.y, [int]$b.width, [int]$b.height)) {
                throw 'Firefox was parented but its initial bounds could not be applied.'
            }
            return @{ embedded = $true; windowHandle = ('{0:X}' -f $child.ToInt64()); processId = [int]$request.processId }
        }
        'resize' {
            if ($script:attachedHandle -eq [IntPtr]::Zero) { throw 'Firefox is not embedded.' }
            $b = $request.bounds
            if (-not [BrowserAppNativeWindow]::Resize($script:attachedHandle, [int]$b.x, [int]$b.y, [int]$b.width, [int]$b.height)) { throw 'SetWindowPos failed.' }
            return @{ resized = $true }
        }
        'focus' {
            if ($script:attachedHandle -eq [IntPtr]::Zero) { throw 'Firefox is not embedded.' }
            $null = [BrowserAppNativeWindow]::SetForegroundWindow($script:attachedHandle)
            $null = [BrowserAppNativeWindow]::SetFocus($script:attachedHandle)
            return @{ focused = $true }
        }
        'detach' {
            if ($script:attachedHandle -ne [IntPtr]::Zero) {
                $null = [BrowserAppNativeWindow]::SetParent($script:attachedHandle, $script:originalParent)
                $null = [BrowserAppNativeWindow]::SetWindowLongPtr($script:attachedHandle, -16, $script:originalStyle)
                $null = [BrowserAppNativeWindow]::SetWindowPos($script:attachedHandle, [IntPtr]::Zero, 0, 0, 900, 650, 0x0004 -bor 0x0020 -bor 0x0040)
            }
            $script:attachedHandle = [IntPtr]::Zero
            return @{ detached = $true }
        }
        'shutdown' {
            if ($script:attachedHandle -ne [IntPtr]::Zero) {
                $null = [BrowserAppNativeWindow]::SetParent($script:attachedHandle, $script:originalParent)
                $null = [BrowserAppNativeWindow]::SetWindowLongPtr($script:attachedHandle, -16, $script:originalStyle)
            }
            $script:attachedHandle = [IntPtr]::Zero
            return @{ stopped = $true }
        }
        default { throw "Unknown native window operation: $($request.operation)" }
    }
}

while ($line = [Console]::In.ReadLine()) {
    $request = $null
    try {
        $request = $line | ConvertFrom-Json
        $result = Invoke-Operation $request
        $response = @{ id = $request.id; ok = $true; result = $result }
    } catch {
        $responseId = 0
        if ($request) { $responseId = $request.id }
        $response = @{ id = $responseId; ok = $false; error = $_.Exception.Message }
    }
    [Console]::Out.WriteLine(($response | ConvertTo-Json -Compress -Depth 6))
}
