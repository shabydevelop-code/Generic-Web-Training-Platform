param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$extensions = @("*.html", "*.js", "*.css", "*.json")
$files = Get-ChildItem -Path (Join-Path $Root "extension") -Recurse -File -Include $extensions
$failed = $false
$literalNewline = [string]([char]92) + "n"

foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    if ($content.Contains($literalNewline)) {
        Write-Error "Literal backslash-n found in source file: $($file.FullName)"
        $failed = $true
    }
}

if ($failed) {
    exit 1
}

Write-Host "Source guard passed: no literal backslash-n sequences found in extension source files."
exit 0
