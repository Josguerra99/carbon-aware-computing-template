#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$ProgramPath,
    [int]$ServerPort = 3916,
    [switch]$Force,
    [switch]$Elevated
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-ProfileIncludesPrivate {
    param($Profile)
    $s = $Profile.ToString()
    return $s -eq "Any" -or $s -match "Private"
}

function Get-AppInboundRules {
    param([string]$ProgramPath)
    $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProgramPath)
    if (-not (Test-Path -LiteralPath $full)) { return @() }
    $base = [System.IO.Path]::GetFileName($full)
    return @(
        Get-NetFirewallRule -DisplayName $base -ErrorAction SilentlyContinue |
            Where-Object { $_.Direction -eq "Inbound" }
    )
}

function Test-NeedsLanAccessFix {
    param([string]$ProgramPath)
    foreach ($rule in Get-AppInboundRules -ProgramPath $ProgramPath) {
        if ($rule.Enabled -ne "True") { continue }
        if ($rule.Action -ne "Block") { continue }
        if (Test-ProfileIncludesPrivate -Profile $rule.Profile) { return $true }
    }
    return $false
}

function Invoke-LanAccessFix {
    param([string]$ProgramPath, [int]$ServerPort)
    $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProgramPath)
    if (-not (Test-Path -LiteralPath $full)) {
        throw "Program not found ($full). Run setup first."
    }

    foreach ($rule in Get-AppInboundRules -ProgramPath $full) {
        if ($rule.Enabled -ne "True") { continue }
        if ($rule.Action -ne "Block") { continue }
        if (-not (Test-ProfileIncludesPrivate -Profile $rule.Profile)) { continue }
        Write-Host "Quita Block en Private: $($rule.DisplayName)"
        Disable-NetFirewallRule -Name $rule.Name | Out-Null
    }

    $allowName = "Carbon Aware Workshop team app Private $ServerPort"
    if (-not (Get-NetFirewallRule -DisplayName $allowName -ErrorAction SilentlyContinue)) {
        Write-Host "Allow inbound para $([System.IO.Path]::GetFileName($full)) (Private, puerto $ServerPort)"
        New-NetFirewallRule -DisplayName $allowName `
            -Direction Inbound -Action Allow -Profile Private `
            -Program $full -Protocol TCP -LocalPort $ServerPort | Out-Null
    } else {
        Write-Host "Regla Allow del taller ya existe."
    }

    $firewallCmd = Join-Path $PSScriptRoot "open-lan-firewall.cmd"
    & cmd.exe /c "`"$firewallCmd`" $ServerPort"
    Write-Host "Listo."
}

if (-not $Force -and -not (Test-NeedsLanAccessFix -ProgramPath $ProgramPath)) {
    exit 0
}

if ($Force) {
    Write-Host "Corrigiendo firewall para la LAN del taller (requiere administrador)..." -ForegroundColor Cyan
}

if (-not (Test-IsAdmin)) {
    if (-not $Elevated) {
        $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ProgramPath `"$ProgramPath`" -ServerPort $ServerPort"
        if ($Force) { $argLine += " -Force" }
        $argLine += " -Elevated"
        $p = Start-Process -FilePath "powershell.exe" -Verb RunAs -WindowStyle Hidden -ArgumentList $argLine -Wait -PassThru
        exit $p.ExitCode
    }
    Write-Error "Run fix-lan-access.cmd from an Administrator Command Prompt."
    exit 1
}

Invoke-LanAccessFix -ProgramPath $ProgramPath -ServerPort $ServerPort
exit 0
