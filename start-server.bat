@echo off
setlocal

cd /d "%~dp0"

echo Starting GWTP API...
dotnet run --project server\GWTP.Api\GWTP.Api.csproj

if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)

endlocal
