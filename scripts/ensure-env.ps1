#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (Test-Path ".env") {
    Write-Host ".env ya existe."
    return
}

if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "Creado .env desde .env.example"
} else {
    @"
# URL base del sitio del taller (te la da el facilitador).
MAIN_SERVER_URL=http://192.168.0.100:3915
PORT=3916
TFJS_BACKEND=gpu
TRAIN_DATASETS=all
HISTORIC_CACHE_TTL_MS=0
REFRESH_HISTORIC=0
"@ | Set-Content -Path ".env" -Encoding utf8
    Write-Host "Creado .env con valores por defecto."
}

Write-Host "Edita .env y pon MAIN_SERVER_URL con la URL del facilitador." -ForegroundColor Yellow
