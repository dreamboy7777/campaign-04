$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'CAMPAIGN 04 Studio.lnk'
$startScript = Join-Path $PSScriptRoot 'start-local.ps1'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start the CAMPAIGN 04 studio at http://localhost:5173/'
$shortcut.Save()

& $startScript
Write-Host "Startup shortcut installed: $shortcutPath"
