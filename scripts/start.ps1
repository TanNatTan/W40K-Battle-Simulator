param(
  [int]$Port = 8080
)

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  Write-Host "Autonomous War Theater: http://localhost:$Port"
  python -m http.server $Port
}
finally {
  Pop-Location
}

