# Budowa VizuApp.exe (PyInstaller): testy, potem dist\VizuApp\ = VizuApp.exe + vizu.ps1 + config.json
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .venv)) { & $Python -m venv .venv }
$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $py -m pip install -q -r requirements.txt pyinstaller==6.11.1
& $py -m unittest discover -s tests -t .
if ($LASTEXITCODE) { throw 'Testy nie przeszly' }
& $py -m PyInstaller --noconfirm --clean --onefile --windowed --name VizuApp `
    --exclude-module PIL --distpath dist\VizuApp --workpath build --specpath build VizuApp.py
if ($LASTEXITCODE) { throw 'PyInstaller: blad' }
Copy-Item vizu.ps1, config.json dist\VizuApp\ -Force
Write-Host "Gotowe: $PSScriptRoot\dist\VizuApp (skopiowac na maszyne do D:\VizuApp)"
