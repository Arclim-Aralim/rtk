param([string]$Server = 'vboxuser@192.168.3.9')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteZip = '/tmp/rostelekom-local-' + [Guid]::NewGuid().ToString('N') + '.zip'
$snapshot = "$root/server-snapshot-$stamp"
New-Item -ItemType Directory -Force $snapshot | Out-Null
$code = @'
import os, sqlite3, tempfile, zipfile
from pathlib import Path
root = Path('/home/vboxuser/rostelekom')
excluded = {'.venv','node_modules','bin','obj','runtime','artifacts','logs','run','.git','__pycache__','tools'}
with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED) as z:
    for directory, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in excluded]
        for name in files:
            path = Path(directory) / name
            if path.is_symlink() or name.endswith(('-wal','-shm','-journal')):
                continue
            relative = path.relative_to(root).as_posix()
            if name.endswith(('.sqlite3','.sqlite','.db')):
                with tempfile.TemporaryDirectory() as tmp:
                    target = Path(tmp) / 'backup.sqlite3'
                    with sqlite3.connect(str(path)) as source, sqlite3.connect(str(target)) as dest:
                        source.backup(dest)
                    z.write(target, relative)
            else:
                z.write(path, relative)
print('Server snapshot created')
'@
$code = "ARCHIVE='$remoteZip'`n" + $code
Write-Host 'Enter the VM password when SSH asks (input is hidden).'
$code | & ssh $Server '/home/vboxuser/rostelekom/.venv/bin/python -'
if ($LASTEXITCODE) { throw 'Server backup failed' }
& scp "${Server}:$remoteZip" "$snapshot/server.zip"
if ($LASTEXITCODE) { throw 'Download failed; remote snapshot retained at the printed /tmp path.' }
& ssh $Server "rm -- '$remoteZip'"
Expand-Archive -LiteralPath "$snapshot/server.zip" -DestinationPath "$snapshot/files"
if (!(Test-Path "$snapshot/files/data/analytics/analytics.sqlite3")) { throw 'Snapshot does not contain the expected database; no local files changed.' }
if (Test-Path "$root/data") { throw "Local data already exists. Download kept in $snapshot; reconcile it before replacing local data." }
Get-ChildItem "$snapshot/files" -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $root -Recurse -Force }
'complete' | Set-Content "$snapshot/TRANSFER-COMPLETE.txt"
Write-Host 'Transfer complete. Starting the Windows build.'
& "$root/scripts/setup-local.ps1"
& "$root/scripts/start-local.ps1" -Rebuild
if ($LASTEXITCODE) { throw 'Local start failed; check logs.' }
