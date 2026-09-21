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
set "STAGING_DIR=%TEMP%\GWTP.Api.publish"
set "HEALTH_URL=http://127.0.0.1:5000/api/health"

sc.exe query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo GWTP API service is not installed.
    echo Run install-gwtp-service.bat first.
    pause
    exit /b 1
)

if exist "%STAGING_DIR%" rmdir /S /Q "%STAGING_DIR%"
mkdir "%STAGING_DIR%"

echo Publishing GWTP API update...
dotnet publish "%~dp0server\GWTP.Api\GWTP.Api.csproj" -c Release -r win-x64 --self-contained false -o "%STAGING_DIR%"
if errorlevel 1 goto :error

echo Stopping GWTP API service...
sc.exe stop "%SERVICE_NAME%" >nul 2>&1
call :wait_for_state STOPPED 30
if errorlevel 1 goto :error

echo Updating published API files...
robocopy "%STAGING_DIR%" "%PUBLISH_DIR%" /MIR /R:2 /W:1 >nul
if errorlevel 8 goto :error

echo Starting GWTP API service...
sc.exe start "%SERVICE_NAME%" >nul
if errorlevel 1 goto :error
call :wait_for_state RUNNING 30
if errorlevel 1 goto :error

echo Checking API health...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(30); do { try { $r=Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } } catch {}; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 goto :error

if exist "%STAGING_DIR%" rmdir /S /Q "%STAGING_DIR%"

echo.
echo GWTP API deployment completed successfully.
echo Health check: OK
pause
exit /b 0

:wait_for_state
set "TARGET_STATE=%~1"
set /a "WAIT_SECONDS=%~2"
:wait_loop
for /f "tokens=3" %%S in ('sc.exe query "%SERVICE_NAME%" ^| findstr /R /C:"STATE"') do set "CURRENT_STATE=%%S"
if /I "%CURRENT_STATE%"=="%TARGET_STATE%" exit /b 0
if %WAIT_SECONDS% LEQ 0 exit /b 1
set /a WAIT_SECONDS-=1
timeout /t 1 /nobreak >nul
goto :wait_loop

:error
if exist "%STAGING_DIR%" rmdir /S /Q "%STAGING_DIR%"
echo.
echo GWTP API deployment failed.
echo Check the service state with: sc.exe query "%SERVICE_NAME%"
pause
exit /b 1
