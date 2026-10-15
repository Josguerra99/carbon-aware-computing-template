# Workshop site (:3915) + WSL TensorFlow team server (:3917) + Windows LAN proxy (:3916).
# Proxy: scripts/win-team-proxy.py (in this repo).
param(
    [switch]$NoReload,
    [switch]$SkipWebsite,
    [string]$WebsiteRoot = $env:WORKSHOP_WEBSITE_PATH
)

$ErrorActionPreference = "Stop"

$StackRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

function Get-EnvMainServerUrl {
    param([string]$RepoRoot)
    $envFile = Join-Path $RepoRoot ".env"
    if (-not (Test-Path -LiteralPath $envFile)) {
        return $null
    }
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*MAIN_SERVER_URL\s*=\s*(.+)\s*$') {
            return $Matches[1].Trim().TrimEnd('/')
        }
    }
    return $null
}

function Test-WorkshopHealthAt {
    param([string]$BaseUrl)
    try {
        $null = Invoke-WebRequest -Uri "$BaseUrl/api/health" -TimeoutSec 6 -UseBasicParsing
        return $true
    } catch {
        return $false
    }
}

function Test-WorkshopHealth {
    $fromEnv = Get-EnvMainServerUrl -RepoRoot $StackRoot
    if ($fromEnv -and (Test-WorkshopHealthAt -BaseUrl $fromEnv)) {
        return $true
    }
    return Test-WorkshopHealthAt -BaseUrl "http://127.0.0.1:3915"
}

function Resolve-WebsiteRoot {
    param([string]$Override)
    if ($Override -and (Test-Path -LiteralPath $Override)) {
        return (Resolve-Path -LiteralPath $Override).Path
    }
    $templateRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    $sibling = Join-Path (Split-Path $templateRoot -Parent) "carbon-aware-computing-website"
    if (Test-Path -LiteralPath $sibling) {
        return (Resolve-Path -LiteralPath $sibling).Path
    }
    return $null
}

function Start-WorkshopSite {
    param([string]$Root)
    $bun = Get-Command bun -ErrorAction SilentlyContinue
    if (-not $bun) {
        throw "bun not found on PATH (needed to start carbon-aware-computing-website)."
    }
    Write-Host "Starting workshop site in new window: $Root"
    Start-Process -WorkingDirectory $Root -FilePath $bun.Source -ArgumentList @("run", "dev") | Out-Null
}

if (-not $SkipWebsite) {
    $envMain = Get-EnvMainServerUrl -RepoRoot $StackRoot
    if (Test-WorkshopHealth) {
        if ($envMain -and (Test-WorkshopHealthAt -BaseUrl $envMain)) {
            Write-Host "Workshop site already up at $envMain (from .env)"
        } else {
            Write-Host "Workshop site already up at http://127.0.0.1:3915"
        }
    } elseif ($envMain -and -not ($envMain -match '^https?://(127\.0\.0\.1|localhost)(:|/|$)')) {
        Write-Host "ERROR: .env MAIN_SERVER_URL=$envMain is not reachable from Windows."
        Write-Host "Use the facilitator LAN URL or: start-wsl-stack.cmd -SkipWebsite"
        exit 1
    } else {
        $siteRoot = Resolve-WebsiteRoot -Override $WebsiteRoot
        if (-not $siteRoot) {
            Write-Host "ERROR: carbon-aware-computing-website not found."
            Write-Host "Set WORKSHOP_WEBSITE_PATH or place it next to this template repo, then:"
            Write-Host "  cd carbon-aware-computing-website && bun run dev"
            exit 1
        }
        Start-WorkshopSite -Root $siteRoot
        $deadline = (Get-Date).AddMinutes(2)
        while ((Get-Date) -lt $deadline) {
            if (Test-WorkshopHealth) {
                Write-Host "Workshop site ready."
                break
            }
            Start-Sleep -Seconds 2
        }
        if (-not (Test-WorkshopHealth)) {
            Write-Host "ERROR: Workshop site did not respond on :3915 within 2 minutes."
            exit 1
        }
    }
}

$startTf = Join-Path $PSScriptRoot "start-wsl-tf.ps1"
if ($NoReload) {
    & $startTf -NoReload
} else {
    & $startTf
}
