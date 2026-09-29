$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "GWTP.BrowserUia.Poc\GWTP.BrowserUia.Poc.csproj"

Write-Host "Building Browser UIA POC..."
dotnet build $project
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starting Browser UIA POC..."
dotnet run --no-build --project $project
exit $LASTEXITCODE
