$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$WslPath = "/mnt/$($Root.Substring(0,1).ToLower())/$($Root.Substring(3) -replace '\\','/')"
wsl.exe bash -lc "sed -i 's/\r$//' '$WslPath/scripts/'*.sh && bash '$WslPath/scripts/setup-wsl-tfjs-cuda-venv.sh'"
