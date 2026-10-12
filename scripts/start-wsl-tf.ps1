param(
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"

function ConvertTo-WslPath {
    param([string]$WindowsRoot)
    if ($WindowsRoot -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLower()
        $rest = $Matches[2] -replace '\\', '/'
        return "/mnt/$drive/$rest"
    }
    $attempt = & wsl.exe wslpath -a "$WindowsRoot" 2>$null
    if ($LASTEXITCODE -eq 0 -and $attempt) {
        return ($attempt | Out-String).Trim()
    }
    throw "Could not convert path to WSL: $WindowsRoot"
}

function Get-WslHostIp {
    $raw = (& wsl.exe hostname -I 2>$null | Out-String).Trim()
    if (-not $raw) {
        return "127.0.0.1"
    }
    return ($raw -split "\s+")[0]
}

function Find-Python {
    foreach ($name in @("python", "python3", "py")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            if ($name -eq "py") { return @($cmd.Source, "-3") }
            return @($cmd.Source)
        }
    }
    throw "Python not found (needed for LAN proxy on port 3916)."
}

$workshopHealth = "http://127.0.0.1:3915/api/health"
try {
    $null = Invoke-WebRequest -Uri $workshopHealth -TimeoutSec 4 -UseBasicParsing
} catch {
    Write-Host "ERROR: Workshop site not responding at $workshopHealth"
    Write-Host "Start: cd carbon-aware-computing-website; bun dev"
    exit 1
}

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$WslPath = ConvertTo-WslPath -WindowsRoot $Root
$proxyScript = Join-Path $Root "scripts\win-team-proxy.py"
$publicPort = 3916
$wslPort = 3917

$targetHost = Get-WslHostIp
Write-Host "Starting Windows LAN proxy :$publicPort -> ${targetHost}:$wslPort (WSL team server) ..."
Write-Host "Browser on :3915 calls YOUR team at http://127.0.0.1:$publicPort (not server-to-server). Register at /register first."
$pythonArgs = @(Find-Python) + @(
    $proxyScript,
    "--listen-port", "$publicPort",
    "--target-host", $targetHost,
    "--target-port", "$wslPort"
)
$proxyProc = Start-Process -FilePath $pythonArgs[0] -ArgumentList $pythonArgs[1..($pythonArgs.Length - 1)] -PassThru -NoNewWindow

if ($NoReload) {
    Write-Host "Nodemon disabled (-NoReload)."
} else {
    Write-Host "Nodemon enabled: src/ changes retrain in WSL."
}

$bashPath = $WslPath -replace "'", "'\\''"
$reloadExport = if ($NoReload) { "export NODEMON_RELOAD=0 && " } else { "export NODEMON_RELOAD=1 && " }
try {
    wsl.exe bash -lc "cd '$bashPath' && sed -i 's/\r$//' scripts/*.sh && export WIN_PROXY=1 && ${reloadExport}bash scripts/start-wsl-tf.sh"
} finally {
    if ($proxyProc -and -not $proxyProc.HasExited) {
        Stop-Process -Id $proxyProc.Id -Force -ErrorAction SilentlyContinue
    }
}
