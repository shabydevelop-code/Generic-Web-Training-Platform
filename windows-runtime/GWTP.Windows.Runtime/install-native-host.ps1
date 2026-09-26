param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.gwtp.windows'
$exePath = Join-Path $PSScriptRoot 'bin\Release\net8.0-windows\GWTP.Windows.Runtime.exe'

Write-Host 'Building GWTP Windows Runtime (Release)...'
dotnet build $PSScriptRoot -c Release
if ($LASTEXITCODE -ne 0) { throw "GWTP Windows Runtime Release build failed with exit code $LASTEXITCODE." }
if (-not (Test-Path $exePath)) { throw "Native host executable not found: $exePath" }

$installDir = Join-Path $env:LOCALAPPDATA 'GWTP\NativeMessaging'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$manifestPath = Join-Path $installDir "$hostName.json"

$template = Get-Content (Join-Path $PSScriptRoot 'native-host-manifest.template.json') -Raw
$manifest = $template.Replace('__HOST_PATH__', $exePath.Replace('\', '\\')).Replace('__EXTENSION_ID__', $ExtensionId)
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $regPath -Force | Out-Null
Set-Item -Path $regPath -Value $manifestPath

$edgeRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
New-Item -Path $edgeRegPath -Force | Out-Null
Set-Item -Path $edgeRegPath -Value $manifestPath

Write-Host "Installed $hostName for Chrome/Edge extension $ExtensionId"
Write-Host "Manifest: $manifestPath"
