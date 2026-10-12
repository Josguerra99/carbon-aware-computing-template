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

function Get-ProgramInboundRules {
    param([string]$ProgramPath)
    $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProgramPath)
    if (-not (Test-Path -LiteralPath $full)) { return @() }

    $base = [System.IO.Path]::GetFileName($full)
    $seen = @{}
    $out = @()

    foreach ($rule in @(Get-NetFirewallRule -DisplayName $base -ErrorAction SilentlyContinue)) {
        if (-not $seen[$rule.Name]) { $seen[$rule.Name] = $true; $out += $rule }
    }

    Get-NetFirewallRule -Direction Inbound -ErrorAction SilentlyContinue | ForEach-Object {
        $rule = $_
        $app = Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue
        if (-not $app.Program) { return }
        try {
            $prog = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($app.Program)
        } catch {
            $prog = $app.Program
        }
        if ($prog -ieq $full -and -not $seen[$rule.Name]) {
            $seen[$rule.Name] = $true
            $out += $rule
        }
    }
    return $out
}

function Test-NeedsLanAccessFix {
    param([string]$ProgramPath, [int]$Port)
    $allowName = "Carbon Aware Workshop team app Private $Port"
    if (-not (Get-NetFirewallRule -DisplayName $allowName -ErrorAction SilentlyContinue)) {
        return $true
    }
    foreach ($rule in Get-ProgramInboundRules -ProgramPath $ProgramPath) {
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
        Write-Warning "Program not found ($full); skipping app firewall rules."
    } else {
        foreach ($rule in Get-ProgramInboundRules -ProgramPath $full) {
            if ($rule.Enabled -ne "True") { continue }
            if ($rule.Action -ne "Block") { continue }
            if (-not (Test-ProfileIncludesPrivate -Profile $rule.Profile)) { continue }
            Write-Host "Disabling inbound Block (Private) for: $($rule.DisplayName)"
            Disable-NetFirewallRule -Name $rule.Name | Out-Null
        }

        $allowName = "Carbon Aware Workshop team app Private $Port"
        if (-not (Get-NetFirewallRule -DisplayName $allowName -ErrorAction SilentlyContinue)) {
            Write-Host "Adding Allow inbound for $([System.IO.Path]::GetFileName($full)) on Private port $Port"
            New-NetFirewallRule -DisplayName $allowName `
                -Direction Inbound -Action Allow -Profile Private `
                -Program $full -Protocol TCP -LocalPort $Port | Out-Null
        }
    }

    $firewallCmd = Join-Path $PSScriptRoot "open-lan-firewall.cmd"
    & cmd.exe /c "`"$firewallCmd`" $Port"
}

if (-not (Test-NeedsLanAccessFix -ProgramPath $ProgramPath -Port $Port)) {
    exit 0
}

if (-not (Test-IsAdmin)) {
    if (-not $Elevated) {
        Write-Host "Windows may block LAN access to this server; adjusting firewall (UAC)..." -ForegroundColor Yellow
        $args = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", $PSCommandPath,
            "-ProgramPath", $ProgramPath,
            "-Port", $Port,
            "-Elevated"
        )
        $p = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $args -Wait -PassThru
        exit $p.ExitCode
    }
    Write-Warning "Could not fix firewall without administrator rights."
    exit 0
}

Invoke-LanAccessFix -ProgramPath $ProgramPath -Port $Port
exit 0
