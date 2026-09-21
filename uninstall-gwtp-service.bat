@echo off
setlocal EnableExtensions

net session >nul 2>&1
if errorlevel 1 (
    echo This script must be run as Administrator.
    pause
    exit /b 1
)

set "SERVICE_NAME=GWTP.Api"

sc.exe query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo GWTP API service is not installed.
    pause
    exit /b 0
)

sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%"
if errorlevel 1 (
    echo Failed to remove GWTP API service.
    pause
    exit /b 1
)

echo GWTP API service removed.
echo Data under %%ProgramData%%\GWTP\Data was preserved.
pause
