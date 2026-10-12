#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $Root

$bunExe = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (Test-Path $bunExe) {
    $env:Path = "$(Split-Path $bunExe);$env:Path"
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "Bun not found. Run scripts\windows\setup.cmd first."
}

$port = if ($env:PORT) { [int]$env:PORT } else { 3916 }
$program = (Get-Command bun).Source

& (Join-Path $PSScriptRoot "ensure-lan-access.ps1") -ProgramPath $program -ServerPort $port -Force
