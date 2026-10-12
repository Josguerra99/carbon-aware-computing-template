#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$Exe,
    [Parameter(Mandatory = $true)]
    [string[]]$ProcessArguments,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [int]$Port = 3916
)

$ErrorActionPreference = "Stop"

Write-Host "Abriendo el puerto $Port un momento para que Windows muestre su aviso..." -ForegroundColor Cyan

$proc = Start-Process -FilePath $Exe -ArgumentList $ProcessArguments -WorkingDirectory $WorkingDirectory -PassThru
Start-Sleep -Seconds 5

if ($proc.HasExited) {
    Write-Warning "El servidor de prueba termino antes de tiempo; el aviso puede salir al arrancar abajo."
    exit 0
}

Write-Host "Servidor de prueba en marcha (PID $($proc.Id))."
Read-Host "Cuando hayas respondido al aviso de Windows (Red privada + Permitir), o si no salio, pulsa Enter"

try {
    & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
} catch {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Continuando..." -ForegroundColor Green
