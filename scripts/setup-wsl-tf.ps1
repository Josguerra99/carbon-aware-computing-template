$ErrorActionPreference = "Stop"

function ConvertTo-WslPath {
    param([string]$WindowsRoot)
    $attempt = & wsl.exe wslpath -a "$WindowsRoot" 2>$null
    if ($LASTEXITCODE -eq 0 -and $attempt) {
        return ($attempt | Out-String).Trim()
    }
    if ($WindowsRoot -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLower()
        $rest = $Matches[2] -replace '\\', '/'
        return "/mnt/$drive/$rest"
    }
    throw "Could not convert path to WSL: $WindowsRoot"
}

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$WslPath = ConvertTo-WslPath -WindowsRoot $Root
Write-Host "Running WSL TF.js GPU setup in $WslPath ..."
$bashPath = $WslPath -replace "'", "'\\''"
wsl.exe bash -lc "cd '$bashPath' && sed -i 's/\r$//' scripts/*.sh && chmod +x scripts/*.sh && bash scripts/setup-wsl-tf.sh"
