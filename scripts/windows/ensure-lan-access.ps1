#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$ProgramPath,
    [int]$Port = 3916,
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
    return @(Get-NetFirewallRule -DisplayName $base -Direction Inbound -ErrorAction SilentlyContinue)
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
    param([string]$ProgramPath, [int]$Port)
    $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProgramPath)
    if (-not (Test-Path -LiteralPath $full)) {
        Write-Warning "Program not found ($full)."
        return
    }

    foreach ($rule in Get-AppInboundRules -ProgramPath $full) {
        if ($rule.Enabled -ne "True") { continue }
        if ($rule.Action -ne "Block") { continue }
        if (-not (Test-ProfileIncludesPrivate -Profile $rule.Profile)) { continue }
        Write-Host "Quita Block en Private: $($rule.DisplayName)"
        Disable-NetFirewallRule -Name $rule.Name | Out-Null
    }

    $allowName = "Carbon Aware Workshop team app Private $Port"
    if (-not (Get-NetFirewallRule -DisplayName $allowName -ErrorAction SilentlyContinue)) {
        Write-Host "Allow inbound para $([System.IO.Path]::GetFileName($full)) (Private, puerto $Port)"
        New-NetFirewallRule -DisplayName $allowName `
            -Direction Inbound -Action Allow -Profile Private `
            -Program $full -Protocol TCP -LocalPort $Port | Out-Null
    }
    Write-Host "Firewall corregido."
}

if (-not (Test-NeedsLanAccessFix -ProgramPath $ProgramPath)) {
    exit 0
}

Write-Host "Windows tiene Bun/Python/Java bloqueado en red privada; hace falta corregir (UAC)..." -ForegroundColor Yellow

if (-not (Test-IsAdmin)) {
    if (-not $Elevated) {
        $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ProgramPath `"$ProgramPath`" -Port $Port -Elevated"
        $p = Start-Process -FilePath "powershell.exe" -Verb RunAs -WindowStyle Hidden -ArgumentList $argLine -Wait -PassThru
        if ($p.ExitCode -ne 0) {
            Write-Warning "Sin admin no se pudo quitar el bloqueo. Vuelve a ejecutar setup o permite la app en Windows Firewall (Private)."
        }
        exit 0
    }
    Write-Warning "Could not fix firewall without administrator rights."
    exit 1
}

Invoke-LanAccessFix -ProgramPath $ProgramPath -Port $Port
exit 0
