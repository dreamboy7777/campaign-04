$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.campaign04-server.pid'

if (Test-Path $pidFile) {
  $serverPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($serverPid) {
    $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $serverPid -Force
      Write-Host "Stopped CAMPAIGN 04 (PID $serverPid)."
    }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}
else {
  Write-Host 'CAMPAIGN 04 is not running from this folder.'
}
