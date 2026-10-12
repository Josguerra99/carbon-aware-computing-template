$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
& nvm use 20.19.0 | Out-Null
Set-Location $Root
# tensorflow = CPU-native (fast). gpu = same package but uses GPU only if CUDA 11 + cuDNN 8 are installed.
$env:TFJS_BACKEND = if ($env:TFJS_BACKEND) { $env:TFJS_BACKEND } else { "tensorflow" }
Write-Host "TFJS_BACKEND=$($env:TFJS_BACKEND)"
npm run start:node
