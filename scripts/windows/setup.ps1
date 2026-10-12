#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $Root

Write-Host "=== Carbon-aware template (TypeScript) - Windows setup ===" -ForegroundColor Cyan
Write-Host "Installs: Bun, project dependencies (bun install)."
Write-Host "Before run: set MAIN_SERVER_URL in .env to the URL from your facilitator (workshop site)."
Write-Host ""

& (Join-Path $PSScriptRoot "../ensure-env.ps1")

function Ensure-Bun {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        Write-Host "Bun: $(bun --version)"
        return
    }
    $bunExe = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
    if (Test-Path $bunExe) {
        $env:Path = "$(Split-Path $bunExe);$env:Path"
        Write-Host "Bun: $(bun --version)"
        return
    }
    Write-Host "Installing Bun..."
    Invoke-RestMethod -Uri "https://bun.sh/install.ps1" | Invoke-Expression
    $env:Path = "$(Join-Path $env:USERPROFILE '.bun\bin');$env:Path"
    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
        throw "Bun install finished but bun is not on PATH. Open a new terminal or add USERPROFILE\.bun\bin to PATH."
    }
    Write-Host "Bun: $(bun --version)"
}

Ensure-Bun

Write-Host "Installing dependencies (bun install)..."
bun install

Write-Host ""
Write-Host "Setup complete. Run: scripts\windows\run.cmd" -ForegroundColor Green
