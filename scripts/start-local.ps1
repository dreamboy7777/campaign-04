$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.campaign04-server.pid'
$logFile = Join-Path $root '.campaign04-server.log'
$errorFile = Join-Path $root '.campaign04-server.error.log'

if (Test-Path $pidFile) {
  $existing = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
    Write-Host "CAMPAIGN 04 is already running at http://localhost:5173/ (PID $existing)"
    exit 0
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Push-Location $root
try {
  if (-not (Test-Path (Join-Path $root 'dist\index.html'))) {
    npm run build
  }

  $process = Start-Process -FilePath 'node' -ArgumentList 'server.mjs' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errorFile -PassThru
  Set-Content -Path $pidFile -Value $process.Id -Encoding ascii

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-WebRequest -Uri 'http://localhost:5173/__health' -UseBasicParsing -TimeoutSec 2
      if ($health.StatusCode -eq 200) {
        Write-Host "CAMPAIGN 04 is live at http://localhost:5173/ (PID $($process.Id))"
        exit 0
      }
    }
    catch {
      if ($process.HasExited) { break }
    }
  }

  throw "CAMPAIGN 04 did not start. Check $errorFile"
}
finally {
  Pop-Location
}
