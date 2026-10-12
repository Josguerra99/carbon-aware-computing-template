#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $Root

$bunExe = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (Test-Path $bunExe) {
    $env:Path = "$(Split-Path $bunExe);$env:Path"
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "Bun not found. Run scripts/windows/setup.ps1 first."
}

& (Join-Path $PSScriptRoot "../ensure-env.ps1")

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -gt 0) {
            $key = $line.Substring(0, $eq).Trim()
            $val = $line.Substring($eq + 1).Trim()
            Set-Item -Path "Env:$key" -Value $val
        }
    }
}

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules missing - running setup..."
    & (Join-Path $PSScriptRoot "setup.ps1")
}

$port = if ($env:PORT) { $env:PORT } else { "3916" }
$bunExe = (Get-Command bun).Source

Write-Host ""
Write-Host "=== Red del taller (Windows) ===" -ForegroundColor Cyan
Write-Host "1) Wi-Fi en perfil PRIVADA."
Write-Host "2) Si Windows pregunta por Bun: elige RED PRIVADA y PERMITIR (no bloquear en privada)." -ForegroundColor Yellow
Write-Host ""

$lanMarker = Join-Path $Root ".local\lan-defender-ok"
if (-not (Test-Path $lanMarker)) {
    New-Item -ItemType Directory -Path (Split-Path $lanMarker) -Force | Out-Null
    & (Join-Path $PSScriptRoot "prompt-lan-firewall.ps1") `
        -Exe $bunExe -ProcessArguments @("run", "dev") -WorkingDirectory $Root -Port ([int]$port)
    Set-Content -Path $lanMarker -Value (Get-Date -Format "o") -Encoding utf8
}

& (Join-Path $PSScriptRoot "ensure-lan-access.ps1") -ProgramPath $bunExe -ServerPort ([int]$port)

Write-Host "Starting forecast server (bun run dev) on port $port..."
bun run dev
