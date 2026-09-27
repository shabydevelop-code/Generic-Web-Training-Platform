@echo off
setlocal

for %%I in ("%~dp0..\..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

echo Starting GWTP API...
dotnet run --project server\GWTP.Api\GWTP.Api.csproj

if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)

endlocal
