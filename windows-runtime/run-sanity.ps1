param(
    [int[]]$Test
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Building GWTP Windows Runtime..."
dotnet build (Join-Path $root "GWTP.Windows.Runtime\GWTP.Windows.Runtime.csproj")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building Windows UIA Test Host..."
dotnet build (Join-Path $root "GWTP.Windows.TestHost\GWTP.Windows.TestHost.csproj")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building Windows GUI sanity runner..."
dotnet build (Join-Path $root "GWTP.Windows.GuiTests\GWTP.Windows.GuiTests.csproj")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Running Windows GUI sanity..."
$runnerArgs = @()
if ($Test) {
    $runnerArgs = @("--") + (($Test -join ","))
    Write-Host "Selected test(s): $($Test -join ', ')"
}

dotnet run --no-build --project (Join-Path $root "GWTP.Windows.GuiTests\GWTP.Windows.GuiTests.csproj") @runnerArgs
exit $LASTEXITCODE
