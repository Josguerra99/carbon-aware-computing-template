@echo off
setlocal
cd /d "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-wsl-tf.ps1 %*
exit /b %ERRORLEVEL%
