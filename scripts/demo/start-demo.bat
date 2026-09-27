@echo off
setlocal

for %%I in ("%~dp0..\..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

echo Starting GWTP Demo Application...
dotnet run --project site\server\DemoCRM.Api\DemoCRM.Api.csproj

if errorlevel 1 (
    echo.
    echo Site server stopped with an error.
    pause
)

endlocal
