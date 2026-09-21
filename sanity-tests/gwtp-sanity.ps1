param(
    [string]$ApiBaseUrl = "http://localhost:5000",
    [string]$SiteBaseUrl = "http://localhost:5100"
)

$ErrorActionPreference = "Stop"
$results = @()

function Add-Result([string]$Name, [bool]$Passed, [string]$Details = "") {
    $script:results += [pscustomobject]@{
        Test = $Name
        Result = if ($Passed) { "PASS" } else { "FAIL" }
        Details = $Details
    }
}

function Test-HttpGet([string]$Name, [string]$Uri, [scriptblock]$Validate) {
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 10
        $ok = & $Validate $response
        Add-Result $Name ([bool]$ok) $(if ($ok) { "" } else { "Unexpected response" })
    } catch {
        Add-Result $Name $false $_.Exception.Message
    }
}

Test-HttpGet "API health" "$ApiBaseUrl/api/health" {
    param($r)
    $r.service -eq "GWTP.Api" -and $r.status -eq "ok"
}

Test-HttpGet "Database health" "$ApiBaseUrl/api/health/database" {
    param($r)
    $r.status -eq "ok" -and [int]$r.tableCount -gt 0
}

try {
    $response = Invoke-WebRequest -Uri "$SiteBaseUrl/site.html" -Method Get -TimeoutSec 10 -UseBasicParsing
    Add-Result "Demo site available" ($response.StatusCode -eq 200) "HTTP $($response.StatusCode)"
} catch {
    Add-Result "Demo site available" $false $_.Exception.Message
}

try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/api/learner/catalog" -Method Get -TimeoutSec 10 | Out-Null
    Add-Result "Learner catalog rejects anonymous access" $false "Anonymous request unexpectedly succeeded"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    Add-Result "Learner catalog rejects anonymous access" ($status -eq 401) "HTTP $status"
}

try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/api/users" -Method Get -TimeoutSec 10 | Out-Null
    Add-Result "Admin API rejects anonymous access" $false "Anonymous request unexpectedly succeeded"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    Add-Result "Admin API rejects anonymous access" ($status -eq 401) "HTTP $status"
}

try {
    $body = @{ username = "__gwtp_sanity_invalid__"; password = "__invalid__" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
    Add-Result "Invalid login rejected" $false "Invalid credentials unexpectedly succeeded"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    Add-Result "Invalid login rejected" ($status -eq 401) "HTTP $status"
}

Write-Host ""
Write-Host "GWTP Sanity Test"
Write-Host "----------------"
$results | Format-Table -AutoSize

$failed = @($results | Where-Object Result -eq "FAIL")
Write-Host ""
Write-Host "$($results.Count - $failed.Count) passed, $($failed.Count) failed"

if ($failed.Count -gt 0) { exit 1 }
exit 0
