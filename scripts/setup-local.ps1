param([string]$PythonExe)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
New-Item -ItemType Directory -Force "$root/run/temp" | Out-Null
$env:TEMP = "$root/run/temp"
$env:TMP = $env:TEMP
if (!$PythonExe) {
    $PythonExe = 'python'
}
& $PythonExe -m venv "$root/.venv"
if ($LASTEXITCODE) { throw 'Python 3.12+ is required. Supply -PythonExe with its full path.' }
& "$root/.venv/Scripts/python.exe" -m pip install -r "$root/services/analytics/requirements.lock"
if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
Push-Location "$root/frontend"
try { & pnpm.cmd install --frozen-lockfile; if ($LASTEXITCODE) { throw 'Frontend dependency installation failed' } } finally { Pop-Location }
Write-Host 'Ready. Run scripts/start-local.ps1.'
