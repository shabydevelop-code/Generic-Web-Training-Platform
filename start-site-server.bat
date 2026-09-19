@echo off
setlocal

cd /d "%~dp0"

echo Starting Demo CRM Site Server...
dotnet run --project site\server\DemoCRM.Api\DemoCRM.Api.csproj

if errorlevel 1 (
    echo.
    echo Site server stopped with an error.
    pause
)

endlocal
