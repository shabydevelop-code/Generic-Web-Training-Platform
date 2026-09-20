$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5000"
$username = "admin"
$password = "admin"
$topicName = "בדיקות מערכת"
$guideName = "בדיקת כל חוקי הוולידציה"
$startUrl = "$baseUrl/validation-test"

$login = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body (@{
  username = $username
  password = $password
} | ConvertTo-Json)

$headers = @{ Authorization = "Bearer $($login.accessToken)" }

$topics = @(Invoke-RestMethod -Uri "$baseUrl/api/topics" -Headers $headers -Method Get)
$topic = $topics | Where-Object { $_.name -eq $topicName } | Select-Object -First 1
if (-not $topic) {
  $topic = Invoke-RestMethod -Uri "$baseUrl/api/topics" -Headers $headers -Method Post -ContentType "application/json" -Body (@{
    name = $topicName
  } | ConvertTo-Json)
}

$steps = @(
  @{
    selector = "#required-field"
    instruction = "בדיקת Required: השאר את השדה ריק ולחץ הבא. לאחר החסימה, הזן ערך כלשהו ולחץ הבא שוב."
    frame = $null
    validation = @{
      engine = "regex"; expression = "^(?=.*\\S).+$"; errorMessage = "יש להזין ערך לפני המעבר לשלב הבא."
      builderType = "required"; builderValue = ""
    }
  },
  @{
    selector = "#equals-field"
    instruction = "בדיקת Equals: הזן ערך שגוי ונסה להמשיך. לאחר מכן הזן GWTP."
    frame = $null
    validation = @{
      engine = "regex"; expression = "^GWTP$"; errorMessage = "הערך חייב להיות GWTP."
      builderType = "equals"; builderValue = "GWTP"
    }
  },
  @{
    selector = "#not-equals-field"
    instruction = "בדיקת Not Equals: הערך BLOCKED צריך להיחסם. שנה אותו לערך אחר."
    frame = $null
    validation = @{
      engine = "regex"; expression = "^(?!BLOCKED$).+$"; errorMessage = "יש להזין ערך שאינו BLOCKED."
      builderType = "not_equals"; builderValue = "BLOCKED"
    }
  },
  @{
    selector = "#contains-field"
    instruction = "בדיקת Contains: הזן ערך שאינו מכיל TRAINING ונסה להמשיך. לאחר מכן הזן טקסט שמכיל TRAINING."
    frame = $null
    validation = @{
      engine = "regex"; expression = ".*TRAINING.*"; errorMessage = "הערך חייב להכיל TRAINING."
      builderType = "contains"; builderValue = "TRAINING"
    }
  },
  @{
    selector = "#changed-field"
    instruction = "בדיקת Changed: נסה להמשיך עם ORIGINAL ללא שינוי. לאחר החסימה שנה את הערך."
    frame = $null
    validation = @{
      engine = "changed"; expression = "__changed__"; errorMessage = "יש לשנות את הערך המקורי."
      builderType = "changed"; builderValue = ""
    }
  }
)

$body = @{
  topicId = [long]$topic.id
  name = $guideName
  startUrl = $startUrl
  isAvailable = $true
  steps = $steps
}

$guides = @(Invoke-RestMethod -Uri "$baseUrl/api/guides" -Headers $headers -Method Get)
$existing = $guides | Where-Object { $_.name -eq $guideName } | Select-Object -First 1
$json = $body | ConvertTo-Json -Depth 10

if ($existing) {
  $result = Invoke-RestMethod -Uri "$baseUrl/api/guides/$($existing.id)" -Headers $headers -Method Put -ContentType "application/json" -Body $json
  Write-Host "Validation test guide updated. GuideId=$($existing.id)"
} else {
  $result = Invoke-RestMethod -Uri "$baseUrl/api/guides" -Headers $headers -Method Post -ContentType "application/json" -Body $json
  Write-Host "Validation test guide created. GuideId=$($result.id)"
}

Write-Host "Start URL: $startUrl"
