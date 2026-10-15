@echo off
setlocal
cd /d "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-wsl-stack.ps1 %*
exit /b %ERRORLEVEL%
