#Requires -Version 5.1
param(
    [switch]$Elevated,
    [switch]$PostReboot,
    [switch]$NoDistroInstall,
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-OptionalFeatureState {
    param([string]$FeatureName)
    $f = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction Stop
    return $f.State
}

function Enable-WslHostFeature {
    param([string]$FeatureName, [string]$Label)
    $state = Get-OptionalFeatureState -FeatureName $FeatureName
    if ($state -eq "Enabled") {
        Write-Host "$Label already enabled."
        return $false
    }
    Write-Host "Enabling $Label ..."
    $result = Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -All -NoRestart
    if ($result.RestartNeeded) {
        $script:RestartNeeded = $true
    }
    return $true
}

function Test-WslDistroRegistered {
    $names = @(
        & wsl.exe -l -q 2>$null |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -and $_ -notmatch '^\(' }
    )
    return $names.Count -gt 0
}

function Invoke-WslPostFeatureSetup {
    Write-Host ""
    Write-Host "Updating WSL ..."
    & wsl.exe --update
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "wsl --update failed (exit $LASTEXITCODE). You can retry after reboot."
    }

    Write-Host "Setting default WSL version to 2 ..."
    & wsl.exe --set-default-version 2
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "wsl --set-default-version 2 failed. Retry after a full reboot."
    }

    if ($NoDistroInstall) {
        Write-Host "Skipping distro install (-NoDistroInstall)."
        return
    }

    if (Test-WslDistroRegistered) {
        Write-Host "WSL distro already registered:"
        & wsl.exe -l -v
        return
    }

    Write-Host "Installing Linux distro: $Distro (first launch may take a few minutes) ..."
    & wsl.exe --install -d $Distro
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "wsl --install failed (exit $LASTEXITCODE)."
        Write-Warning "If you saw 0x80370114, reboot, then run: scripts/windows/setup-wsl-features.cmd -PostReboot"
    }
}

Write-Host "=== Carbon-aware template - enable WSL on Windows ===" -ForegroundColor Cyan
Write-Host "Fixes error 0x80370114 (Virtual Machine Platform / WSL optional features)."
Write-Host "Requires Administrator. A reboot is often required before the first distro install."
Write-Host ""

if (-not (Test-IsAdmin)) {
    if (-not $Elevated) {
        $argList = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", $PSCommandPath,
            "-Elevated"
        )
        if ($PostReboot) { $argList += "-PostReboot" }
        if ($NoDistroInstall) { $argList += "-NoDistroInstall" }
        if ($Distro -ne "Ubuntu") { $argList += "-Distro"; $argList += $Distro }
        Write-Host "Requesting elevation (UAC) ..."
        $p = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argList -Wait -PassThru
        exit $p.ExitCode
    }
    Write-Error "Run scripts/windows/setup-wsl-features.cmd from an elevated terminal."
    exit 1
}

$script:RestartNeeded = $false

if (-not $PostReboot) {
    $null = Enable-WslHostFeature -FeatureName "Microsoft-Windows-Subsystem-Linux" -Label "Windows Subsystem for Linux"
    $null = Enable-WslHostFeature -FeatureName "VirtualMachinePlatform" -Label "Virtual Machine Platform"

    if ($script:RestartNeeded) {
        Write-Host ""
        Write-Host "A reboot is required before WSL can start." -ForegroundColor Yellow
        Write-Host "After reboot, run:" -ForegroundColor Yellow
        Write-Host "  scripts/windows/setup-wsl-features.cmd -PostReboot" -ForegroundColor Yellow
        Write-Host ""
        $answer = Read-Host "Reboot now? (y/N)"
        if ($answer -match '^[yY]') {
            Restart-Computer -Force
        }
        exit 0
    }
}

Invoke-WslPostFeatureSetup

Write-Host ""
Write-Host "Next: install TensorFlow.js in WSL with npm run setup:wsl" -ForegroundColor Green
Write-Host "Then: npm run start:wsl or scripts/windows/start-wsl-stack.cmd" -ForegroundColor Green
