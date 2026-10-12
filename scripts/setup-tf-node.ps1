# Native TensorFlow.js for Node on Windows (prebuilds target Node 20, not 22+).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Use Node 20 LTS (nvm): nvm install 20.19.0 && nvm use 20.19.0"
& nvm use 20.19.0 | Out-Null

$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) {
  throw "node.exe not found at $node after nvm use 20.19.0"
}
& $node -v

Set-Location $Root
Write-Host "Installing native TensorFlow.js bindings..."
npm install @tensorflow/tfjs-node-gpu@4.22.0 @tensorflow/tfjs-node@4.22.0 --save
npm rebuild @tensorflow/tfjs-node-gpu @tensorflow/tfjs-node

function Copy-TfDllToNapiV8($PackageName) {
  $lib = Join-Path $Root "node_modules\@tensorflow\$PackageName\lib"
  $from = Join-Path $lib "napi-v9\tensorflow.dll"
  $to = Join-Path $lib "napi-v8\tensorflow.dll"
  if (Test-Path $from) {
    Copy-Item $from $to -Force
    Write-Host "Copied tensorflow.dll for $PackageName (napi-v8)."
  }
}

Copy-TfDllToNapiV8 "tfjs-node"
Copy-TfDllToNapiV8 "tfjs-node-gpu"

Write-Host ""
Write-Host "Verify (expect: tensorflow (native)):"
Write-Host '  $env:TFJS_BACKEND="tensorflow"; npm run start:node'
Write-Host ""
Write-Host "GPU: tfjs-node-gpu 4.22 needs CUDA 11.x + cuDNN 8 on PATH (cudart64_110.dll, cudnn64_8.dll)."
Write-Host "Without those DLLs it still runs fast on CPU-native. For full GPU, use WSL + Linux setup or install CUDA 11 toolkit."
Write-Host "Done."
