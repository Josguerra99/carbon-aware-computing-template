@echo off
setlocal
cd /d "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-wsl-tfjs-cuda-venv.ps1 %*
exit /b %ERRORLEVEL%
