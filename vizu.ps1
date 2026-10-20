# Uruchamiane z PLC (HMIScreen, jak D:\Calc\calc.ps1): start VizuApp.exe albo okno na wierzch, gdy juz dziala
$w = New-Object -ComObject WScript.Shell
if (-not (Get-Process VizuApp -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath (Join-Path $PSScriptRoot 'VizuApp.exe') -WorkingDirectory $PSScriptRoot
    Start-Sleep -Milliseconds 1500
}
$w.SendKeys('%')
$null = $w.AppActivate('VizuApp')
