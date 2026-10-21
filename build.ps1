# Paczka na maszyne: testy, strona (public/), potem dist\VizuApp\ = node.exe + app\ + config.json + vizu.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm ci
if ($LASTEXITCODE) { throw 'npm ci: blad' }
npm test
if ($LASTEXITCODE) { throw 'Testy nie przeszly' }
npm run build:client
if ($LASTEXITCODE) { throw 'Budowa strony: blad' }

$dist = Join-Path $PSScriptRoot 'dist\VizuApp'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $dist 'app\src') | Out-Null
Copy-Item src\server, src\shared (Join-Path $dist 'app\src') -Recurse
Copy-Item public (Join-Path $dist 'app') -Recurse
Copy-Item package.json, package-lock.json (Join-Path $dist 'app')
Push-Location (Join-Path $dist 'app')
npm ci --omit=dev --ignore-scripts
$code = $LASTEXITCODE
Pop-Location
if ($code) { throw 'npm ci --omit=dev: blad' }
Copy-Item (Get-Command node).Source $dist
Copy-Item vizu.ps1, config.json $dist
# logowanie (#145): users.json (skroty hasel, scripts/users.mjs) tylko z lokalnego pliku - nie ma go w repo
if (Test-Path users.json) { Copy-Item users.json $dist } else { Write-Warning 'Brak users.json - logowanie wylaczone (node scripts/users.mjs set Operator ...)' }
Write-Host "Gotowe: $dist (skopiowac na maszyne do D:\VizuApp)"
