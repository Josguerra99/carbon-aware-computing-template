@echo off
setlocal EnableDelayedExpansion
set "PORT=%~1"
if "%PORT%"=="" set "PORT=3916"
set "RULE_NAME=Carbon Aware Workshop Team (!PORT!)"

netsh advfirewall firewall show rule name="!RULE_NAME!" >nul 2>&1
if not errorlevel 1 (
  echo Firewall: rule already exists ^(!RULE_NAME!^).
  exit /b 0
)

echo Firewall: allow inbound TCP !PORT! on Private networks (LocalSubnet only^)...
netsh advfirewall firewall add rule name="!RULE_NAME!" dir=in action=allow protocol=TCP localport=!PORT! profile=private remoteip=localsubnet
if errorlevel 1 (
  echo.
  echo Could not add firewall rule. Run setup from an Administrator Command Prompt, or run:
  echo   netsh advfirewall firewall add rule name="!RULE_NAME!" dir=in action=allow protocol=TCP localport=!PORT! profile=private remoteip=localsubnet
  exit /b 1
)

echo Firewall: rule added. Other PCs on the same LAN can reach port !PORT! (not the public internet^).
exit /b 0
