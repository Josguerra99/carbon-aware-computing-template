@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-lan-access.ps1" %*
if errorlevel 1 exit /b 1
