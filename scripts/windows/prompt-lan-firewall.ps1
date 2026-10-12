#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$Exe,
    [Parameter(Mandatory = $true)]
    [Alias("Args")]
    [string[]]$ProcessArguments,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [int]$Port = 3916
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Aviso de Windows Firewall (no pide administrador) ===" -ForegroundColor Cyan
Write-Host "Arrancamos el servidor un momento en el puerto $Port para que Windows muestre su ventana."
Write-Host "Si aparece: elige RED PRIVADA y PERMITIR (no bloquear en redes privadas)." -ForegroundColor Yellow
Write-Host ""

$proc = Start-Process -FilePath $Exe -ArgumentList $ProcessArguments -WorkingDirectory $WorkingDirectory -PassThru
Start-Sleep -Seconds 4

if ($proc.HasExited) {
    Write-Warning "El servidor de prueba termino antes de tiempo. Puedes repetir con run.cmd; Windows puede preguntar entonces."
    exit 0
}

Write-Host "Servidor de prueba en marcha (PID $($proc.Id))."
Read-Host "Cuando hayas respondido al aviso de Windows (o si no salio), pulsa Enter"

try {
    & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
} catch {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Listo. En el taller usa scripts\windows\run.cmd" -ForegroundColor Green
