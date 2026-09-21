@echo off
setlocal EnableExtensions

net session >nul 2>&1
if errorlevel 1 (
    echo This script must be run as Administrator.
    pause
    exit /b 1
)

cd /d "%~dp0"

set "SERVICE_NAME=GWTP.Api"
set "PUBLISH_DIR=%ProgramData%\GWTP\Api"
set "DATA_DIR=%ProgramData%\GWTP\Data"
set "SOURCE_DATA=%~dp0database"

echo Publishing GWTP API...
dotnet publish "%~dp0server\GWTP.Api\GWTP.Api.csproj" -c Release -r win-x64 --self-contained false -o "%PUBLISH_DIR%"
if errorlevel 1 goto :error

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

if not exist "%DATA_DIR%\schema.sql" copy /Y "%SOURCE_DATA%\schema.sql" "%DATA_DIR%\schema.sql" >nul
if not exist "%DATA_DIR%\GWTP.db" if exist "%SOURCE_DATA%\GWTP.db" copy /Y "%SOURCE_DATA%\GWTP.db" "%DATA_DIR%\GWTP.db" >nul

sc.exe query "%SERVICE_NAME%" >nul 2>&1
if not errorlevel 1 (
    sc.exe stop "%SERVICE_NAME%" >nul 2>&1
    sc.exe delete "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

sc.exe create "%SERVICE_NAME%" binPath= "\"%PUBLISH_DIR%\GWTP.Api.exe\"" start= auto DisplayName= "GWTP API"
if errorlevel 1 goto :error

sc.exe description "%SERVICE_NAME%" "Generic Web Training Platform central API"
sc.exe failure "%SERVICE_NAME%" reset= 86400 actions= restart/5000/restart/5000/restart/5000

reg.exe add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%" /v Environment /t REG_MULTI_SZ /d "ASPNETCORE_URLS=http://127.0.0.1:5000\0GWTP_DATA_PATH=%DATA_DIR%" /f >nul
if errorlevel 1 goto :error

sc.exe start "%SERVICE_NAME%"
if errorlevel 1 goto :error

echo.
echo GWTP API service installed and started.
echo API:  http://127.0.0.1:5000
echo Data: %DATA_DIR%
echo.
pause
exit /b 0

:error
echo.
echo Installation failed.
pause
exit /b 1
