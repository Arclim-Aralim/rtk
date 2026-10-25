$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
foreach ($service in @('gateway','analytics')) {
    $file = "$root/run/$service-local.pid"
    if (!(Test-Path $file)) { continue }
    $processId = [int](Get-Content $file)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($process) {
        $expected = if ($service -eq 'gateway') { "$root/runtime/windows/Gateway.exe" } else { "$root/.venv/Scripts/python.exe" }
        if ($process.ExecutablePath -and [IO.Path]::GetFullPath($process.ExecutablePath) -eq [IO.Path]::GetFullPath($expected)) { Stop-Process -Id $processId -Force } else { throw "PID $processId does not belong to this project; refusing to stop it." }
    }
    Remove-Item -LiteralPath $file
}
Write-Host 'Local services stopped.'
