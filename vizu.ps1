# Uruchamiane z PLC (HMIScreen, jak D:\Calc\calc.ps1): serwer VizuApp (node.exe w tle) i strona w przegladarce;
# gdy strona juz jest otwarta - tylko okno na wierzch
$port = 8128
$cfgFile = Join-Path $PSScriptRoot 'config.json'
if (Test-Path $cfgFile) {
    $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
    if ($cfg.httpPort) { $port = $cfg.httpPort }
}
$url = "http://127.0.0.1:$port/"

function Test-VizuServer {
    try { $null = Invoke-WebRequest "$($url)api/health" -UseBasicParsing -TimeoutSec 1; $true } catch { $false }
}

if (-not (Test-VizuServer)) {
    Start-Process -FilePath (Join-Path $PSScriptRoot 'node.exe') -ArgumentList '"app\src\server\main.js"' `
        -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($i = 0; $i -lt 50 -and -not (Test-VizuServer); $i++) { Start-Sleep -Milliseconds 200 }
}

$w = New-Object -ComObject WScript.Shell
$w.SendKeys('%')
if (-not $w.AppActivate('VizuApp')) {
    $browser = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($browser) { Start-Process -FilePath $browser -ArgumentList "--app=$url", '--start-maximized' }
    else { Start-Process $url }
}
