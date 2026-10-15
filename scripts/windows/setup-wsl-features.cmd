@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-wsl-features.ps1" %*
if errorlevel 1 exit /b 1
