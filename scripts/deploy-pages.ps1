$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$temp = Join-Path $env:TEMP 'campaign04-gh-pages'
$repo = 'https://github.com/dreamboy7777/campaign-04.git'

Push-Location $root
try {
  $env:VITE_BASE = '/campaign-04/'
  npm run build

  if (Test-Path $temp) {
    Remove-Item -Recurse -Force $temp
  }
  New-Item -ItemType Directory -Path $temp | Out-Null
  Copy-Item -Path (Join-Path $root 'dist\*') -Destination $temp -Recurse -Force
  New-Item -ItemType File -Path (Join-Path $temp '.nojekyll') -Force | Out-Null

  Push-Location $temp
  try {
    git init -b gh-pages | Out-Null
    git add -A
    git -c user.name='dreamboy7777' -c user.email='dreamboy7777@users.noreply.github.com' commit -m 'Deploy production build' | Out-Null
    git remote add origin $repo
    git push --force origin gh-pages
  }
  finally {
    Pop-Location
  }

  Write-Host 'Published to https://dreamboy7777.github.io/campaign-04/'
}
finally {
  Pop-Location
  Remove-Item Env:VITE_BASE -ErrorAction SilentlyContinue
}
