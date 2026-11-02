$ErrorActionPreference = "Continue"
$out = Join-Path $PSScriptRoot "..\public\seed"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$negative = "text, watermark, logo, signature, extra fingers, deformed hands, plastic skin, CGI, 3d render, oversaturated, modern luxury advertisement"

$jobs = @(
  @{ name = "hero-perfume"; model = "SDXL 1.0"; w = 896; h = 1152; prompt = "an intimate still life photograph of a clear glass perfume bottle resting on rumpled white cotton bedsheets, soft morning window light, 2006 fragrance campaign, 35mm film grain, warm ivory tones, shallow depth of field, quiet and romantic, no text" },
  @{ name = "portrait-wall"; model = "Juggernaut XL"; w = 768; h = 1024; prompt = "editorial fashion photograph of a young woman in a plain white tank top leaning against a bare plaster wall, harsh direct on-camera flash, 2005 independent fashion catalog, natural skin texture, slightly overexposed, unposed intimate framing, warm muted color, 35mm grain, no text" },
  @{ name = "bedroom-flash"; model = "SDXL 1.0"; w = 768; h = 1024; prompt = "candid flash photograph of two young women in a messy teenage bedroom at night, band posters on the wall, string lights, disposable camera, 2007 tumblr photo diary, grainy, imperfect, spontaneous, natural skin, no text" },
  @{ name = "night-drive"; model = "SDXL 1.0"; w = 1024; h = 768; prompt = "blurry photograph taken from the back seat of a car at night, city lights smeared across a rain-covered window, friend's shoulder in the foreground, 2006 compact digital camera, green and amber color cast, heavy grain, melancholic, no text" },
  @{ name = "editorial-red"; model = "Juggernaut XL"; w = 768; h = 1024; prompt = "experimental fashion editorial portrait of a woman with wet hair and a red slip dress against a dark green studio backdrop, direct flash, unusual crop, strong shadow, 2002 i-D magazine, analog film texture, bold and intimate, no text" },
  @{ name = "perfume-flowers"; model = "ICBINP - I Can't Believe It's Not Photography"; w = 896; h = 1152; prompt = "vintage fragrance advertisement photograph, a small amber perfume bottle among wilted pale pink roses on a marble table, late afternoon light, faded color print, 1980s romantic luxury, soft focus, dust and grain, no text" },
  @{ name = "zine-desk"; model = "SDXL 1.0"; w = 1024; h = 768; prompt = "overhead photograph of an independent zine in progress on a wooden desk, photocopied portraits, scissors, glue stick, handwritten notes, 35mm film photographs scattered, tungsten lamp light, warm shadows, messy creative studio, no readable text" },
  @{ name = "mirror-tumblr"; model = "SDXL 1.0"; w = 768; h = 1024; prompt = "grainy mirror self-portrait in a dim bedroom, young woman holding a small digital camera, flash reflecting, posters and fairy lights, 2012 tumblr aesthetic, slightly blurry, personal and diaristic, muted pink and grey, no text" },
  @{ name = "clothing-rail"; model = "Juggernaut XL"; w = 896; h = 1152; prompt = "minimal fashion catalog photograph of vintage clothing on a metal rail against a warm white studio wall, soft daylight, muted earthy palette, 2004 independent label lookbook, quiet composition, 35mm grain, no text" },
  @{ name = "cover-closeup"; model = "Juggernaut XL"; w = 896; h = 1152; prompt = "close-up editorial beauty portrait of a young woman with freckles and minimal makeup, direct flash, dark background, strong graphic composition, 2003 independent magazine cover, analog grain, natural skin texture, no text" }
)

$submitted = @()
foreach ($j in $jobs) {
  $body = @{
    prompt = "$($j.prompt) ### $negative"
    params = @{ width = $j.w; height = $j.h; steps = 26; n = 1; sampler_name = "k_euler_a"; cfg_scale = 6.5 }
    models = @($j.model)
    r2 = $true
    nsfw = $false
    censor_nsfw = $false
    slow_workers = $true
  } | ConvertTo-Json -Depth 6
  try {
    $r = Invoke-WebRequest -Uri "https://stablehorde.net/api/v2/generate/async" -Method Post -Body $body -ContentType "application/json" -Headers @{ apikey = "0000000000"; "Client-Agent" = "campaign04:0.1:seed" } -TimeoutSec 90 -UseBasicParsing
    $id = ($r.Content | ConvertFrom-Json).id
    $submitted += @{ id = $id; name = $j.name }
    Write-Output "SUBMITTED $($j.name) $id"
  } catch {
    Write-Output "SUBMIT FAIL $($j.name) $($_.Exception.Message)"
  }
  Start-Sleep -Milliseconds 800
}

$pending = $submitted
for ($round = 0; $round -lt 120 -and $pending.Count -gt 0; $round++) {
  Start-Sleep -Seconds 10
  $next = @()
  foreach ($s in $pending) {
    try {
      $c = (Invoke-WebRequest -Uri "https://stablehorde.net/api/v2/generate/check/$($s.id)" -TimeoutSec 30 -UseBasicParsing).Content | ConvertFrom-Json
      if ($c.done) {
        $j = (Invoke-WebRequest -Uri "https://stablehorde.net/api/v2/generate/status/$($s.id)" -TimeoutSec 60 -UseBasicParsing).Content | ConvertFrom-Json
        if ($j.generations -and $j.generations.Count -gt 0) {
          $url = $j.generations[0].img
          $path = Join-Path $out "$($s.name).webp"
          Invoke-WebRequest -Uri $url -OutFile $path -TimeoutSec 120 -UseBasicParsing
          Write-Output "DONE $($s.name) $((Get-Item $path).Length) bytes"
        } else {
          Write-Output "EMPTY $($s.name)"
        }
      } else {
        Write-Output "WAIT $($s.name) pos=$($c.queue_position) eta=$($c.wait_time)"
        $next += $s
      }
    } catch {
      Write-Output "POLL ERR $($s.name) $($_.Exception.Message)"
      $next += $s
    }
  }
  $pending = $next
}
Write-Output "FINISHED"
