using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

// Allows the same API executable to run interactively during development
// or under the Windows Service Control Manager in a server-like deployment.
builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "GWTP API";
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Extension", policy =>
    {
        policy
            .SetIsOriginAllowed(origin => origin.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("Extension");

var configuredDataPath = builder.Configuration["GWTP_DATA_PATH"];
var databaseDirectory = string.IsNullOrWhiteSpace(configuredDataPath)
    ? Path.Combine(FindProjectRoot(app.Environment.ContentRootPath), "database")
    : Path.GetFullPath(Environment.ExpandEnvironmentVariables(configuredDataPath));

Directory.CreateDirectory(databaseDirectory);

var databasePath = Path.Combine(databaseDirectory, "GWTP.db");
var schemaPath = Path.Combine(databaseDirectory, "schema.sql");

if (!File.Exists(schemaPath))
{
    throw new FileNotFoundException(
        $"GWTP database schema was not found at '{schemaPath}'. The configured GWTP_DATA_PATH must contain schema.sql.",
        schemaPath);
}

InitializeDatabase(databasePath, schemaPath);
ApplyDatabaseMigrations(databasePath);
ApplySanityTestUsersMigration(databasePath);
EnsureDevelopmentAdmin(databasePath);
EnsureDemoSiteGuide(databasePath);
ApplyDemoScreenNameMigration(databasePath);

var sessions = new Dictionary<string, long>(StringComparer.Ordinal);
var sessionLock = new object();

app.MapGet("/api/health", () => Results.Ok(new
{
    service = "GWTP.Api",
    status = "ok"
}));

app.MapGet("/api/health/database", () =>
{
    using var connection = OpenConnection(databasePath);

    using var command = connection.CreateCommand();
    command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';";

    var tableCount = Convert.ToInt32(command.ExecuteScalar());

    return Results.Ok(new
    {
        database = "GWTP.db",
        status = "ok",
        tableCount
    });
});

app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
    {
        return Results.BadRequest(new { message = "Username and password are required." });
    }

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT Id, Username, DisplayName, PasswordHash, IsActive
        FROM Users
        WHERE Username = $username COLLATE NOCASE;
        """;
    command.Parameters.AddWithValue("$username", request.Username.Trim());

    using var reader = command.ExecuteReader();

    if (!reader.Read())
    {
        return Results.Unauthorized();
    }

    var userId = reader.GetInt64(0);
    var username = reader.GetString(1);
    var displayName = reader.IsDBNull(2) ? null : reader.GetString(2);
    var passwordHash = reader.GetString(3);
    var isActive = reader.GetInt64(4) == 1;

    if (!isActive)
    {
        return Results.Unauthorized();
    }

    var passwordHasher = new PasswordHasher<object>();
    var verification = passwordHasher.VerifyHashedPassword(new object(), passwordHash, request.Password);

    if (verification == PasswordVerificationResult.Failed)
    {
        return Results.Unauthorized();
    }

    reader.Close();

    using var rolesCommand = connection.CreateCommand();
    rolesCommand.CommandText = "SELECT Role FROM UserRoles WHERE UserId = $userId ORDER BY Role;";
    rolesCommand.Parameters.AddWithValue("$userId", userId);

    using var rolesReader = rolesCommand.ExecuteReader();
    var roles = new List<string>();

    while (rolesReader.Read())
    {
        roles.Add(rolesReader.GetString(0));
    }

    var accessToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    lock (sessionLock)
    {
        sessions[accessToken] = userId;
    }

    return Results.Ok(new LoginResponse(userId, username, displayName, roles, accessToken));
});

var adminUsers = app.MapGroup("/api/users");
adminUsers.AddEndpointFilter(async (context, next) =>
{
    var httpContext = context.HttpContext;
    var authorization = httpContext.Request.Headers.Authorization.ToString();

    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Unauthorized();
    }

    var token = authorization["Bearer ".Length..].Trim();
    long userId;

    lock (sessionLock)
    {
        if (!sessions.TryGetValue(token, out userId))
        {
            return Results.Unauthorized();
        }
    }

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT COUNT(*)
        FROM Users u
        INNER JOIN UserRoles r ON r.UserId = u.Id
        WHERE u.Id = $userId AND u.IsActive = 1 AND r.Role = 'admin';
        """;
    command.Parameters.AddWithValue("$userId", userId);

    if (Convert.ToInt32(command.ExecuteScalar()) == 0)
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Results.Empty;
    }

    return await next(context);
});

adminUsers.MapPost("", (CreateUserRequest request) =>
{
    var username = request.Username?.Trim().ToLowerInvariant();
    var displayName = request.DisplayName?.Trim();
    var role = request.Role?.Trim().ToLowerInvariant();

    if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password) ||
        role is not ("editor" or "learner"))
    {
        return Results.BadRequest(new { message = "Display name, username, password and a valid role are required." });
    }

    if (username.Length is < 5 or > 30)
    {
        return Results.BadRequest(new { code = "USERNAME_LENGTH", message = "Username must contain 5-30 characters." });
    }

    if (!System.Text.RegularExpressions.Regex.IsMatch(username, @"^[a-z0-9._]+$"))
    {
        return Results.BadRequest(new { code = "USERNAME_INVALID_CHARACTERS", message = "Username contains invalid characters." });
    }

    if (request.Password.Length is < 6 or > 20 || request.Password.Any(char.IsWhiteSpace))
    {
        return Results.BadRequest(new { code = "PASSWORD_REQUIREMENTS", message = "Password does not meet the requirements." });
    }

    using var connection = OpenConnection(databasePath);

    using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = "SELECT COUNT(*) FROM Users WHERE Username = $username COLLATE NOCASE;";
    existsCommand.Parameters.AddWithValue("$username", username);

    if (Convert.ToInt32(existsCommand.ExecuteScalar()) > 0)
    {
        return Results.Conflict(new { message = "Username already exists." });
    }

    var passwordHasher = new PasswordHasher<object>();
    var passwordHash = passwordHasher.HashPassword(new object(), request.Password);

    using var transaction = connection.BeginTransaction();

    using var userCommand = connection.CreateCommand();
    userCommand.Transaction = transaction;
    userCommand.CommandText = """
        INSERT INTO Users (Username, DisplayName, PasswordHash, IsActive)
        VALUES ($username, $displayName, $passwordHash, 1);
        SELECT last_insert_rowid();
        """;
    userCommand.Parameters.AddWithValue("$username", username);
    userCommand.Parameters.AddWithValue("$displayName", string.IsNullOrWhiteSpace(displayName) ? DBNull.Value : displayName);
    userCommand.Parameters.AddWithValue("$passwordHash", passwordHash);
    var userId = Convert.ToInt64(userCommand.ExecuteScalar());

    using var roleCommand = connection.CreateCommand();
    roleCommand.Transaction = transaction;
    roleCommand.CommandText = "INSERT INTO UserRoles (UserId, Role) VALUES ($userId, $role);";
    roleCommand.Parameters.AddWithValue("$userId", userId);
    roleCommand.Parameters.AddWithValue("$role", role);
    roleCommand.ExecuteNonQuery();

    transaction.Commit();

    return Results.Created($"/api/users/{userId}",
        new UserResponse(userId, username, displayName, true, [role]));
});

adminUsers.MapPut("/{id:long}", (long id, UpdateUserRequest request, HttpContext httpContext) =>
{
    var displayName = request.DisplayName?.Trim();

    if (string.IsNullOrWhiteSpace(displayName))
    {
        return Results.BadRequest(new { message = "Display name is required." });
    }

    using var connection = OpenConnection(databasePath);

    using var userLookup = connection.CreateCommand();
    userLookup.CommandText = """
        SELECT u.Username, r.Role
        FROM Users u
        LEFT JOIN UserRoles r ON r.UserId = u.Id
        WHERE u.Id = $id;
        """;
    userLookup.Parameters.AddWithValue("$id", id);

    using var userReader = userLookup.ExecuteReader();
    if (!userReader.Read())
    {
        return Results.NotFound();
    }

    var username = userReader.GetString(0);
    var existingRole = userReader.IsDBNull(1) ? null : userReader.GetString(1);
    userReader.Close();

    var isAdminUser = string.Equals(existingRole, "admin", StringComparison.OrdinalIgnoreCase);

    if (isAdminUser)
    {
        var authorization = httpContext.Request.Headers.Authorization.ToString();
        var token = authorization["Bearer ".Length..].Trim();
        long sessionUserId;

        lock (sessionLock)
        {
            if (!sessions.TryGetValue(token, out sessionUserId) || sessionUserId != id)
            {
                return Results.Forbid();
            }
        }
    }

    var role = isAdminUser ? "admin" : request.Role?.Trim().ToLowerInvariant();

    if (!isAdminUser && role is not ("editor" or "learner"))
    {
        return Results.BadRequest(new { message = "A valid role is required." });
    }

    var isActive = isAdminUser ? true : request.IsActive;
    if (!string.IsNullOrEmpty(request.NewPassword) &&
        (request.NewPassword.Length is < 6 or > 20 || request.NewPassword.Any(char.IsWhiteSpace)))
    {
        return Results.BadRequest(new { code = "PASSWORD_REQUIREMENTS", message = "Password does not meet the requirements." });
    }

    var passwordHash = string.IsNullOrWhiteSpace(request.NewPassword)
        ? null
        : new PasswordHasher<object>().HashPassword(new object(), request.NewPassword);

    using var transaction = connection.BeginTransaction();

    using var userCommand = connection.CreateCommand();
    userCommand.Transaction = transaction;
    userCommand.CommandText = """
        UPDATE Users
        SET DisplayName = $displayName,
            IsActive = $isActive,
            PasswordHash = COALESCE($passwordHash, PasswordHash)
        WHERE Id = $id;
        """;
    userCommand.Parameters.AddWithValue("$displayName", displayName);
    userCommand.Parameters.AddWithValue("$isActive", isActive ? 1 : 0);
    userCommand.Parameters.AddWithValue("$passwordHash", passwordHash is null ? DBNull.Value : passwordHash);
    userCommand.Parameters.AddWithValue("$id", id);
    userCommand.ExecuteNonQuery();

    if (!isAdminUser)
    {
        using var deleteRoles = connection.CreateCommand();
        deleteRoles.Transaction = transaction;
        deleteRoles.CommandText = "DELETE FROM UserRoles WHERE UserId = $id;";
        deleteRoles.Parameters.AddWithValue("$id", id);
        deleteRoles.ExecuteNonQuery();

        using var roleCommand = connection.CreateCommand();
        roleCommand.Transaction = transaction;
        roleCommand.CommandText = "INSERT INTO UserRoles (UserId, Role) VALUES ($id, $role);";
        roleCommand.Parameters.AddWithValue("$id", id);
        roleCommand.Parameters.AddWithValue("$role", role);
        roleCommand.ExecuteNonQuery();
    }

    transaction.Commit();

    return Results.Ok(new UserResponse(id, username, displayName, isActive, [role!]));
});

adminUsers.MapDelete("/{id:long}/learning-activity", (long id) =>
{
    using var connection = OpenConnection(databasePath);

    using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = "SELECT COUNT(*) FROM Users WHERE Id = $id;";
    existsCommand.Parameters.AddWithValue("$id", id);
    if (Convert.ToInt32(existsCommand.ExecuteScalar()) == 0)
        return Results.NotFound();

    using var transaction = connection.BeginTransaction();

    using (var stepProgressCommand = connection.CreateCommand())
    {
        stepProgressCommand.Transaction = transaction;
        stepProgressCommand.CommandText = "DELETE FROM UserStepProgress WHERE UserId = $id;";
        stepProgressCommand.Parameters.AddWithValue("$id", id);
        stepProgressCommand.ExecuteNonQuery();
    }

    using (var progressCommand = connection.CreateCommand())
    {
        progressCommand.Transaction = transaction;
        progressCommand.CommandText = "DELETE FROM UserProgress WHERE UserId = $id;";
        progressCommand.Parameters.AddWithValue("$id", id);
        progressCommand.ExecuteNonQuery();
    }

    transaction.Commit();
    return Results.NoContent();
});

adminUsers.MapDelete("/{id:long}", (long id) =>
{
    using var connection = OpenConnection(databasePath);

    using var roleCommand = connection.CreateCommand();
    roleCommand.CommandText = """
        SELECT COUNT(*)
        FROM UserRoles
        WHERE UserId = $id AND Role = 'admin';
        """;
    roleCommand.Parameters.AddWithValue("$id", id);

    if (Convert.ToInt32(roleCommand.ExecuteScalar()) > 0)
        return Results.Conflict(new { message = "Admin users cannot be deleted." });

    using var command = connection.CreateCommand();
    command.CommandText = "DELETE FROM Users WHERE Id = $id;";
    command.Parameters.AddWithValue("$id", id);

    if (command.ExecuteNonQuery() == 0)
        return Results.NotFound();

    return Results.NoContent();
});

adminUsers.MapGet("", () =>
{
    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT u.Id, u.Username, u.DisplayName, u.IsActive, r.Role
        FROM Users u
        LEFT JOIN UserRoles r ON r.UserId = u.Id
        ORDER BY u.Id, r.Role;
        """;

    using var reader = command.ExecuteReader();
    var users = new Dictionary<long, UserResponse>();

    while (reader.Read())
    {
        var id = reader.GetInt64(0);

        if (!users.TryGetValue(id, out var user))
        {
            user = new UserResponse(
                id,
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.GetInt64(3) == 1,
                []);

            users.Add(id, user);
        }

        if (!reader.IsDBNull(4))
        {
            user.Roles.Add(reader.GetString(4));
        }
    }

    return Results.Ok(users.Values);
});


app.MapGet("/api/learner/catalog", (HttpContext httpContext) =>
{
    var authorization = httpContext.Request.Headers.Authorization.ToString();

    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        return Results.Unauthorized();

    var token = authorization["Bearer ".Length..].Trim();
    long userId;

    lock (sessionLock)
    {
        if (!sessions.TryGetValue(token, out userId))
            return Results.Unauthorized();
    }

    using var connection = OpenConnection(databasePath);

    using var userCommand = connection.CreateCommand();
    userCommand.CommandText = "SELECT COUNT(*) FROM Users WHERE Id = $userId AND IsActive = 1;";
    userCommand.Parameters.AddWithValue("$userId", userId);

    if (Convert.ToInt32(userCommand.ExecuteScalar()) == 0)
        return Results.Unauthorized();

    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT t.Id, t.Name, g.Id, g.Name, CASE WHEN p.IsCompleted = 1 THEN 'Completed' WHEN p.GuideId IS NOT NULL THEN 'InProgress' ELSE 'NotStarted' END
        FROM Topics t
        INNER JOIN Guides g ON g.TopicId = t.Id
        LEFT JOIN UserProgress p ON p.GuideId = g.Id AND p.UserId = $userId
        WHERE g.IsAvailable = 1
        ORDER BY t.Name COLLATE NOCASE, g.Name COLLATE NOCASE, g.Id;
        """;

    command.Parameters.AddWithValue("$userId", userId);

    using var reader = command.ExecuteReader();
    var topics = new Dictionary<long, LearnerTopicResponse>();

    while (reader.Read())
    {
        var topicId = reader.GetInt64(0);

        if (!topics.TryGetValue(topicId, out var topic))
        {
            topic = new LearnerTopicResponse(topicId, reader.GetString(1), []);
            topics.Add(topicId, topic);
        }

        topic.Guides.Add(new LearnerGuideResponse(reader.GetInt64(2), reader.GetString(3), reader.GetString(4)));
    }

    return Results.Ok(topics.Values);
});

app.MapGet("/api/learner/guides/{id:long}", (long id, HttpContext httpContext) =>
{
    var authorization = httpContext.Request.Headers.Authorization.ToString();

    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        return Results.Unauthorized();

    var token = authorization["Bearer ".Length..].Trim();
    long userId;

    lock (sessionLock)
    {
        if (!sessions.TryGetValue(token, out userId))
            return Results.Unauthorized();
    }

    using var connection = OpenConnection(databasePath);

    using var userCommand = connection.CreateCommand();
    userCommand.CommandText = "SELECT COUNT(*) FROM Users WHERE Id = $userId AND IsActive = 1;";
    userCommand.Parameters.AddWithValue("$userId", userId);

    if (Convert.ToInt32(userCommand.ExecuteScalar()) == 0)
        return Results.Unauthorized();

    using var guideCommand = connection.CreateCommand();
    guideCommand.CommandText = """
        SELECT Id, TopicId, Name, StartInstruction, IsAvailable
        FROM Guides
        WHERE Id = $id AND IsAvailable = 1;
        """;
    guideCommand.Parameters.AddWithValue("$id", id);

    using var guideReader = guideCommand.ExecuteReader();
    if (!guideReader.Read())
        return Results.NotFound();

    var guideId = guideReader.GetInt64(0);
    var topicId = guideReader.GetInt64(1);
    var name = guideReader.GetString(2);
    var startInstruction = guideReader.IsDBNull(3) ? null : guideReader.GetString(3);
    var isAvailable = guideReader.GetInt64(4) == 1;
    guideReader.Close();

    using var stepsCommand = connection.CreateCommand();
    stepsCommand.CommandText = """
        SELECT Id, StepOrder, Selector, Instruction, ScreenName, FrameTarget, ValidationEngine, ValidationExpression, ValidationErrorMessage, ValidationBuilderType, ValidationBuilderValue, TargetType, Runtime, WindowsTarget
        FROM GuideSteps
        WHERE GuideId = $guideId
        ORDER BY StepOrder;
        """;
    stepsCommand.Parameters.AddWithValue("$guideId", guideId);

    using var stepsReader = stepsCommand.ExecuteReader();
    var steps = new List<GuideStepResponse>();

    while (stepsReader.Read())
    {
        steps.Add(new GuideStepResponse(
            stepsReader.GetInt64(0),
            stepsReader.GetInt32(1),
            stepsReader.GetString(2),
            stepsReader.IsDBNull(11) ? "element" : stepsReader.GetString(11),
            stepsReader.GetString(3),
            stepsReader.IsDBNull(4) ? null : stepsReader.GetString(4),
            stepsReader.IsDBNull(5) ? null : JsonSerializer.Deserialize<FrameTarget>(stepsReader.GetString(5)),
            stepsReader.IsDBNull(6) || stepsReader.IsDBNull(7) ? null : new ValidationRule(
                stepsReader.GetString(6),
                stepsReader.GetString(7),
                stepsReader.IsDBNull(8) ? "" : stepsReader.GetString(8),
                stepsReader.IsDBNull(9) ? null : stepsReader.GetString(9),
                stepsReader.IsDBNull(10) ? null : stepsReader.GetString(10)),
            stepsReader.IsDBNull(12) ? "web" : stepsReader.GetString(12),
            stepsReader.IsDBNull(13) ? null : JsonSerializer.Deserialize<WindowsTargetDescriptor>(stepsReader.GetString(13))));
    }

    return Results.Ok(new GuideResponse(guideId, topicId, name, startInstruction, isAvailable, steps));
});

static long? GetAuthenticatedUserId(HttpContext httpContext, Dictionary<string, long> sessions, object sessionLock)
{
    var authorization = httpContext.Request.Headers.Authorization.ToString();
    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;

    var token = authorization["Bearer ".Length..].Trim();
    lock (sessionLock)
    {
        return sessions.TryGetValue(token, out var userId) ? userId : null;
    }
}

app.MapPost("/api/learner/progress/start/{guideId:long}", (long guideId, HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();

    using var connection = OpenConnection(databasePath);

    using var guideCommand = connection.CreateCommand();
    guideCommand.CommandText = "SELECT COUNT(*) FROM Guides WHERE Id = $guideId AND IsAvailable = 1;";
    guideCommand.Parameters.AddWithValue("$guideId", guideId);
    if (Convert.ToInt32(guideCommand.ExecuteScalar()) == 0) return Results.NotFound();

    using var stepCountCommand = connection.CreateCommand();
    stepCountCommand.CommandText = "SELECT COUNT(*) FROM GuideSteps WHERE GuideId = $guideId;";
    stepCountCommand.Parameters.AddWithValue("$guideId", guideId);
    var totalSteps = Convert.ToInt32(stepCountCommand.ExecuteScalar());
    if (totalSteps == 0) return Results.BadRequest(new { message = "Guide has no steps." });

    using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO UserProgress
            (UserId, GuideId, CurrentStepOrder, Status, IsCompleted, StartedAt, LastActivityAt, CompletedAt)
        VALUES
            ($userId, $guideId, 1, 'Started', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(UserId, GuideId) DO UPDATE SET
            Status = CASE WHEN UserProgress.IsCompleted = 1 THEN 'Started' ELSE UserProgress.Status END,
            IsCompleted = 0,
            CurrentStepOrder = CASE WHEN UserProgress.IsCompleted = 1 THEN 1 ELSE UserProgress.CurrentStepOrder END,
            StartedAt = CASE WHEN UserProgress.IsCompleted = 1 THEN CURRENT_TIMESTAMP ELSE UserProgress.StartedAt END,
            LastActivityAt = CURRENT_TIMESTAMP,
            CompletedAt = NULL;
        """;
    command.Parameters.AddWithValue("$userId", userId.Value);
    command.Parameters.AddWithValue("$guideId", guideId);
    command.ExecuteNonQuery();

    using var currentStepCommand = connection.CreateCommand();
    currentStepCommand.CommandText = "SELECT CurrentStepOrder FROM UserProgress WHERE UserId = $userId AND GuideId = $guideId;";
    currentStepCommand.Parameters.AddWithValue("$userId", userId.Value);
    currentStepCommand.Parameters.AddWithValue("$guideId", guideId);
    var currentStepOrder = Convert.ToInt32(currentStepCommand.ExecuteScalar());

    return Results.Ok(new { guideId, stepIndex = currentStepOrder - 1, totalSteps });
});

app.MapPost("/api/learner/progress/restart/{guideId:long}", (long guideId, HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();

    using var connection = OpenConnection(databasePath);

    using var guideCommand = connection.CreateCommand();
    guideCommand.CommandText = "SELECT COUNT(*) FROM Guides WHERE Id = $guideId AND IsAvailable = 1;";
    guideCommand.Parameters.AddWithValue("$guideId", guideId);
    if (Convert.ToInt32(guideCommand.ExecuteScalar()) == 0) return Results.NotFound();

    using var stepCountCommand = connection.CreateCommand();
    stepCountCommand.CommandText = "SELECT COUNT(*) FROM GuideSteps WHERE GuideId = $guideId;";
    stepCountCommand.Parameters.AddWithValue("$guideId", guideId);
    var totalSteps = Convert.ToInt32(stepCountCommand.ExecuteScalar());
    if (totalSteps == 0) return Results.BadRequest(new { message = "Guide has no steps." });

    using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO UserProgress
            (UserId, GuideId, CurrentStepOrder, Status, IsCompleted, StartedAt, LastActivityAt, CompletedAt)
        VALUES
            ($userId, $guideId, 1, 'Started', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(UserId, GuideId) DO UPDATE SET
            CurrentStepOrder = 1,
            Status = 'Started',
            IsCompleted = 0,
            StartedAt = CURRENT_TIMESTAMP,
            LastActivityAt = CURRENT_TIMESTAMP,
            CompletedAt = NULL;
        """;
    command.Parameters.AddWithValue("$userId", userId.Value);
    command.Parameters.AddWithValue("$guideId", guideId);
    command.ExecuteNonQuery();

    return Results.Ok(new { guideId, stepIndex = 0, totalSteps });
});

app.MapPost("/api/learner/progress/move", (ProgressMoveRequest request, HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();
    if (request.Direction is not (-1 or 1)) return Results.BadRequest(new { message = "Direction must be -1 or 1." });

    using var connection = OpenConnection(databasePath);

    using var progressCommand = connection.CreateCommand();
    progressCommand.CommandText = """
        SELECT CurrentStepOrder
        FROM UserProgress
        WHERE UserId = $userId AND GuideId = $guideId AND IsCompleted = 0;
        """;
    progressCommand.Parameters.AddWithValue("$userId", userId.Value);
    progressCommand.Parameters.AddWithValue("$guideId", request.GuideId);
    var currentValue = progressCommand.ExecuteScalar();
    if (currentValue is null) return Results.NotFound();

    using var countCommand = connection.CreateCommand();
    countCommand.CommandText = "SELECT COUNT(*) FROM GuideSteps WHERE GuideId = $guideId;";
    countCommand.Parameters.AddWithValue("$guideId", request.GuideId);
    var totalSteps = Convert.ToInt32(countCommand.ExecuteScalar());

    var currentOrder = Convert.ToInt32(currentValue);
    var nextOrder = Math.Clamp(currentOrder + request.Direction, 1, totalSteps);

    // A forward move means the learner successfully completed the current training step.
    // Repeating the same step is idempotent because UserStepProgress has a unique key.
    if (request.Direction == 1 && nextOrder > currentOrder)
    {
        using var completeStepCommand = connection.CreateCommand();
        completeStepCommand.CommandText = """
            INSERT INTO UserStepProgress (UserId, GuideId, GuideStepId, CompletedAt)
            SELECT $userId, $guideId, Id, CURRENT_TIMESTAMP
            FROM GuideSteps
            WHERE GuideId = $guideId AND StepOrder = $currentOrder
            ON CONFLICT(UserId, GuideStepId) DO NOTHING;
            """;
        completeStepCommand.Parameters.AddWithValue("$userId", userId.Value);
        completeStepCommand.Parameters.AddWithValue("$guideId", request.GuideId);
        completeStepCommand.Parameters.AddWithValue("$currentOrder", currentOrder);
        completeStepCommand.ExecuteNonQuery();
    }

    using var updateCommand = connection.CreateCommand();
    updateCommand.CommandText = """
        UPDATE UserProgress
        SET CurrentStepOrder = $stepOrder,
            Status = 'InProgress',
            LastActivityAt = CURRENT_TIMESTAMP
        WHERE UserId = $userId AND GuideId = $guideId;
        """;
    updateCommand.Parameters.AddWithValue("$stepOrder", nextOrder);
    updateCommand.Parameters.AddWithValue("$userId", userId.Value);
    updateCommand.Parameters.AddWithValue("$guideId", request.GuideId);
    updateCommand.ExecuteNonQuery();

    return Results.Ok(new { guideId = request.GuideId, stepIndex = nextOrder - 1, totalSteps });
});

app.MapPost("/api/learner/progress/complete/{guideId:long}", (long guideId, HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();

    using var connection = OpenConnection(databasePath);

    using (var completeStepCommand = connection.CreateCommand())
    {
        completeStepCommand.CommandText = """
            INSERT INTO UserStepProgress (UserId, GuideId, GuideStepId, CompletedAt)
            SELECT p.UserId, p.GuideId, gs.Id, CURRENT_TIMESTAMP
            FROM UserProgress p
            INNER JOIN GuideSteps gs
                ON gs.GuideId = p.GuideId AND gs.StepOrder = p.CurrentStepOrder
            WHERE p.UserId = $userId AND p.GuideId = $guideId AND p.IsCompleted = 0
            ON CONFLICT(UserId, GuideStepId) DO NOTHING;
            """;
        completeStepCommand.Parameters.AddWithValue("$userId", userId.Value);
        completeStepCommand.Parameters.AddWithValue("$guideId", guideId);
        completeStepCommand.ExecuteNonQuery();
    }

    using var command = connection.CreateCommand();
    command.CommandText = """
        UPDATE UserProgress
        SET Status = 'Completed',
            IsCompleted = 1,
            LastActivityAt = CURRENT_TIMESTAMP,
            CompletedAt = CURRENT_TIMESTAMP
        WHERE UserId = $userId AND GuideId = $guideId AND IsCompleted = 0;
        """;
    command.Parameters.AddWithValue("$userId", userId.Value);
    command.Parameters.AddWithValue("$guideId", guideId);

    if (command.ExecuteNonQuery() == 0) return Results.NotFound();

    return Results.Ok(new { guideId, completed = true });
});

app.MapGet("/api/learner/progress/steps/{guideId:long}", (long guideId, HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT GuideStepId, CompletedAt
        FROM UserStepProgress
        WHERE UserId = $userId AND GuideId = $guideId
        ORDER BY CompletedAt, GuideStepId;
        """;
    command.Parameters.AddWithValue("$userId", userId.Value);
    command.Parameters.AddWithValue("$guideId", guideId);

    using var reader = command.ExecuteReader();
    var completedSteps = new List<object>();
    while (reader.Read())
    {
        completedSteps.Add(new
        {
            guideStepId = reader.GetInt64(0),
            completedAt = reader.GetString(1)
        });
    }

    return Results.Ok(new { guideId, completedSteps });
});

app.MapGet("/api/learner/progress/active", (HttpContext httpContext) =>
{
    var userId = GetAuthenticatedUserId(httpContext, sessions, sessionLock);
    if (userId is null) return Results.Unauthorized();

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT p.GuideId, p.CurrentStepOrder, COUNT(gs.Id)
        FROM UserProgress p
        INNER JOIN Guides g ON g.Id = p.GuideId AND g.IsAvailable = 1
        INNER JOIN GuideSteps gs ON gs.GuideId = p.GuideId
        WHERE p.UserId = $userId AND p.IsCompleted = 0
        GROUP BY p.GuideId, p.CurrentStepOrder, p.LastActivityAt
        ORDER BY p.LastActivityAt DESC
        LIMIT 1;
        """;
    command.Parameters.AddWithValue("$userId", userId.Value);

    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.Ok(new { active = false });

    return Results.Ok(new
    {
        active = true,
        guideId = reader.GetInt64(0),
        stepIndex = reader.GetInt32(1) - 1,
        totalSteps = reader.GetInt32(2)
    });
});

var editorTopics = app.MapGroup("/api/topics");
editorTopics.AddEndpointFilter(async (context, next) =>
{
    var authorization = context.HttpContext.Request.Headers.Authorization.ToString();

    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Unauthorized();
    }

    var token = authorization["Bearer ".Length..].Trim();
    long userId;

    lock (sessionLock)
    {
        if (!sessions.TryGetValue(token, out userId))
        {
            return Results.Unauthorized();
        }
    }

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT COUNT(*)
        FROM Users u
        INNER JOIN UserRoles r ON r.UserId = u.Id
        WHERE u.Id = $userId AND u.IsActive = 1 AND r.Role = 'editor';
        """;
    command.Parameters.AddWithValue("$userId", userId);

    if (Convert.ToInt32(command.ExecuteScalar()) == 0)
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Results.Empty;
    }

    return await next(context);
});

editorTopics.MapGet("", () =>
{
    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT Id, Name FROM Topics ORDER BY Name COLLATE NOCASE, Id;";

    using var reader = command.ExecuteReader();
    var topics = new List<TopicResponse>();

    while (reader.Read())
    {
        topics.Add(new TopicResponse(reader.GetInt64(0), reader.GetString(1)));
    }

    return Results.Ok(topics);
});

editorTopics.MapPost("", (CreateTopicRequest request) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.BadRequest(new { message = "Topic name is required." });
    }

    using var connection = OpenConnection(databasePath);

    using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = "SELECT COUNT(*) FROM Topics WHERE Name = $name COLLATE NOCASE;";
    existsCommand.Parameters.AddWithValue("$name", name);

    if (Convert.ToInt32(existsCommand.ExecuteScalar()) > 0)
    {
        return Results.Conflict(new { message = "Topic name already exists." });
    }

    using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO Topics (Name)
        VALUES ($name);
        SELECT last_insert_rowid();
        """;
    command.Parameters.AddWithValue("$name", name);

    var topicId = Convert.ToInt64(command.ExecuteScalar());
    return Results.Created($"/api/topics/{topicId}", new TopicResponse(topicId, name));
});



editorTopics.MapPut("/{id:long}", (long id, CreateTopicRequest request) =>
{
    var name = request.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest(new { message = "Topic name is required." });

    using var connection = OpenConnection(databasePath);

    using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = "SELECT COUNT(*) FROM Topics WHERE Name = $name COLLATE NOCASE AND Id <> $id;";
    existsCommand.Parameters.AddWithValue("$name", name);
    existsCommand.Parameters.AddWithValue("$id", id);
    if (Convert.ToInt32(existsCommand.ExecuteScalar()) > 0)
        return Results.Conflict(new { message = "Topic name already exists." });

    using var command = connection.CreateCommand();
    command.CommandText = "UPDATE Topics SET Name = $name WHERE Id = $id;";
    command.Parameters.AddWithValue("$name", name);
    command.Parameters.AddWithValue("$id", id);
    if (command.ExecuteNonQuery() == 0) return Results.NotFound();

    return Results.Ok(new TopicResponse(id, name));
});

editorTopics.MapDelete("/{id:long}", (long id) =>
{
    using var connection = OpenConnection(databasePath);

    using var guideCommand = connection.CreateCommand();
    guideCommand.CommandText = "SELECT COUNT(*) FROM Guides WHERE TopicId = $id;";
    guideCommand.Parameters.AddWithValue("$id", id);
    if (Convert.ToInt32(guideCommand.ExecuteScalar()) > 0)
        return Results.Conflict(new { message = "Topic has assigned guides." });

    using var command = connection.CreateCommand();
    command.CommandText = "DELETE FROM Topics WHERE Id = $id;";
    command.Parameters.AddWithValue("$id", id);
    if (command.ExecuteNonQuery() == 0) return Results.NotFound();

    return Results.NoContent();
});

var editorGuides = app.MapGroup("/api/guides");
editorGuides.AddEndpointFilter(async (context, next) =>
{
    var authorization = context.HttpContext.Request.Headers.Authorization.ToString();

    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Unauthorized();
    }

    var token = authorization["Bearer ".Length..].Trim();
    long userId;

    lock (sessionLock)
    {
        if (!sessions.TryGetValue(token, out userId))
        {
            return Results.Unauthorized();
        }
    }

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT COUNT(*)
        FROM Users u
        INNER JOIN UserRoles r ON r.UserId = u.Id
        WHERE u.Id = $userId AND u.IsActive = 1 AND r.Role = 'editor';
        """;
    command.Parameters.AddWithValue("$userId", userId);

    if (Convert.ToInt32(command.ExecuteScalar()) == 0)
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Results.Empty;
    }

    return await next(context);
});

editorGuides.MapGet("", () =>
{
    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT g.Id, g.TopicId, t.Name, g.Name, g.IsAvailable,
               COUNT(gs.Id) AS StepCount
        FROM Guides g
        INNER JOIN Topics t ON t.Id = g.TopicId
        LEFT JOIN GuideSteps gs ON gs.GuideId = g.Id
        GROUP BY g.Id, g.TopicId, t.Name, g.Name, g.IsAvailable
        ORDER BY t.Name COLLATE NOCASE, g.Name COLLATE NOCASE, g.Id;
        """;

    using var reader = command.ExecuteReader();
    var guides = new List<object>();

    while (reader.Read())
    {
        guides.Add(new
        {
            id = reader.GetInt64(0),
            topicId = reader.GetInt64(1),
            topicName = reader.GetString(2),
            name = reader.GetString(3),
            isAvailable = reader.GetInt64(4) == 1,
            stepCount = reader.GetInt32(5)
        });
    }

    return Results.Ok(guides);
});

editorGuides.MapGet("/{id:long}", (long id) =>
{
    using var connection = OpenConnection(databasePath);

    using var guideCommand = connection.CreateCommand();
    guideCommand.CommandText = """
        SELECT Id, TopicId, Name, StartInstruction, IsAvailable
        FROM Guides
        WHERE Id = $id;
        """;
    guideCommand.Parameters.AddWithValue("$id", id);

    using var guideReader = guideCommand.ExecuteReader();
    if (!guideReader.Read())
    {
        return Results.NotFound();
    }

    var guideId = guideReader.GetInt64(0);
    var topicId = guideReader.GetInt64(1);
    var name = guideReader.GetString(2);
    var startInstruction = guideReader.IsDBNull(3) ? null : guideReader.GetString(3);
    var isAvailable = guideReader.GetInt64(4) == 1;
    guideReader.Close();

    using var stepsCommand = connection.CreateCommand();
    stepsCommand.CommandText = """
        SELECT Id, StepOrder, Selector, Instruction, ScreenName, FrameTarget, ValidationEngine, ValidationExpression, ValidationErrorMessage, ValidationBuilderType, ValidationBuilderValue, TargetType, Runtime, WindowsTarget
        FROM GuideSteps
        WHERE GuideId = $guideId
        ORDER BY StepOrder;
        """;
    stepsCommand.Parameters.AddWithValue("$guideId", guideId);

    using var stepsReader = stepsCommand.ExecuteReader();
    var steps = new List<GuideStepResponse>();

    while (stepsReader.Read())
    {
        steps.Add(new GuideStepResponse(
            stepsReader.GetInt64(0),
            stepsReader.GetInt32(1),
            stepsReader.GetString(2),
            stepsReader.IsDBNull(11) ? "element" : stepsReader.GetString(11),
            stepsReader.GetString(3),
            stepsReader.IsDBNull(4) ? null : stepsReader.GetString(4),
            stepsReader.IsDBNull(5) ? null : JsonSerializer.Deserialize<FrameTarget>(stepsReader.GetString(5)),
            stepsReader.IsDBNull(6) || stepsReader.IsDBNull(7) ? null : new ValidationRule(
                stepsReader.GetString(6),
                stepsReader.GetString(7),
                stepsReader.IsDBNull(8) ? "" : stepsReader.GetString(8),
                stepsReader.IsDBNull(9) ? null : stepsReader.GetString(9),
                stepsReader.IsDBNull(10) ? null : stepsReader.GetString(10)),
            stepsReader.IsDBNull(12) ? "web" : stepsReader.GetString(12),
            stepsReader.IsDBNull(13) ? null : JsonSerializer.Deserialize<WindowsTargetDescriptor>(stepsReader.GetString(13))));
    }

    return Results.Ok(new GuideResponse(guideId, topicId, name, startInstruction, isAvailable, steps));
});

editorGuides.MapPut("/{id:long}", (long id, CreateGuideRequest request) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(request.StartInstruction) || request.TopicId <= 0 || request.Steps is null)
        return Results.BadRequest(new { message = "Topic, guide name and start instruction are required." });

    if (request.IsAvailable && request.Steps.Count == 0)
        return Results.BadRequest(new { message = "An available guide must contain at least one step." });

    if (request.Steps.Any(step => !IsValidStepTarget(step)))
        return Results.BadRequest(new { message = "Every step requires a valid runtime-specific target; instruction-only steps require no element target." });

    if (request.Steps.Any(step => string.Equals(step.TargetType, "none", StringComparison.OrdinalIgnoreCase) && step.Validation is not null))
        return Results.BadRequest(new { message = "Instruction-only steps cannot contain element validation." });

    if (request.Steps.Any(step => !IsValidStepValidation(step.Validation)))
        return Results.BadRequest(new { message = "One or more step validations are invalid." });

    using var connection = OpenConnection(databasePath);

    using var topicCommand = connection.CreateCommand();
    topicCommand.CommandText = "SELECT COUNT(*) FROM Topics WHERE Id = $topicId;";
    topicCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    if (Convert.ToInt32(topicCommand.ExecuteScalar()) == 0)
        return Results.BadRequest(new { message = "The selected topic does not exist." });

    using var transaction = connection.BeginTransaction();

    using var guideCommand = connection.CreateCommand();
    guideCommand.Transaction = transaction;
    guideCommand.CommandText = "UPDATE Guides SET TopicId = $topicId, Name = $name, StartInstruction = $startInstruction, IsAvailable = $isAvailable WHERE Id = $id;";
    guideCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    guideCommand.Parameters.AddWithValue("$name", name);
    guideCommand.Parameters.AddWithValue("$startInstruction", (object?)request.StartInstruction?.Trim() ?? DBNull.Value);
    guideCommand.Parameters.AddWithValue("$isAvailable", request.IsAvailable ? 1 : 0);
    guideCommand.Parameters.AddWithValue("$id", id);
    if (guideCommand.ExecuteNonQuery() == 0)
    {
        transaction.Rollback();
        return Results.NotFound();
    }

    List<GuideStepResponse> savedSteps;
    try
    {
        savedSteps = SaveGuideSteps(connection, transaction, id, request.Steps);
    }
    catch (InvalidOperationException ex)
    {
        transaction.Rollback();
        return Results.BadRequest(new { message = ex.Message });
    }

    transaction.Commit();

    return Results.Ok(new GuideResponse(
        id,
        request.TopicId,
        name,
        request.StartInstruction?.Trim(),
        request.IsAvailable,
        savedSteps));
});

editorGuides.MapPut("/{id:long}/steps", (long id, List<CreateGuideStepRequest> steps) =>
{
    if (steps is null)
        return Results.BadRequest(new { message = "Steps are required." });

    if (steps.Any(step => string.IsNullOrWhiteSpace(step.Instruction) || (!string.Equals(step.TargetType, "none", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(step.Selector))))
        return Results.BadRequest(new { message = "Every step requires an instruction; element steps also require a selector." });

    if (steps.Any(step => string.Equals(step.TargetType, "none", StringComparison.OrdinalIgnoreCase) && step.Validation is not null))
        return Results.BadRequest(new { message = "Instruction-only steps cannot contain element validation." });

    if (steps.Any(step => !IsValidStepValidation(step.Validation)))
        return Results.BadRequest(new { message = "One or more step validations are invalid." });

    using var connection = OpenConnection(databasePath);

    using var guideExistsCommand = connection.CreateCommand();
    guideExistsCommand.CommandText = "SELECT COUNT(*) FROM Guides WHERE Id = $id;";
    guideExistsCommand.Parameters.AddWithValue("$id", id);
    if (Convert.ToInt32(guideExistsCommand.ExecuteScalar()) == 0)
        return Results.NotFound();

    using var transaction = connection.BeginTransaction();

    List<GuideStepResponse> savedSteps;
    try
    {
        savedSteps = SaveGuideSteps(connection, transaction, id, steps);
    }
    catch (InvalidOperationException ex)
    {
        transaction.Rollback();
        return Results.BadRequest(new { message = ex.Message });
    }

    transaction.Commit();

    return Results.Ok(savedSteps);
});

editorGuides.MapDelete("/{id:long}", (long id) =>
{
    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = "DELETE FROM Guides WHERE Id = $id;";
    command.Parameters.AddWithValue("$id", id);

    if (command.ExecuteNonQuery() == 0)
        return Results.NotFound();

    return Results.NoContent();
});

editorGuides.MapPost("", (CreateGuideRequest request) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(request.StartInstruction) || request.TopicId <= 0 || request.Steps is null)
    {
        return Results.BadRequest(new { message = "Topic, guide name and start instruction are required." });
    }

    if (request.IsAvailable && request.Steps.Count == 0)
    {
        return Results.BadRequest(new { message = "An available guide must contain at least one step." });
    }

    if (request.Steps.Any(step => !IsValidStepTarget(step)))
    {
        return Results.BadRequest(new { message = "Every step requires a valid runtime-specific target; instruction-only steps require no element target." });
    }

    if (request.Steps.Any(step => string.Equals(step.TargetType, "none", StringComparison.OrdinalIgnoreCase) && step.Validation is not null))
    {
        return Results.BadRequest(new { message = "Instruction-only steps cannot contain element validation." });
    }

    if (request.Steps.Any(step => !IsValidStepValidation(step.Validation)))
    {
        return Results.BadRequest(new { message = "One or more step validations are invalid." });
    }

    using var connection = OpenConnection(databasePath);

    using var topicCommand = connection.CreateCommand();
    topicCommand.CommandText = "SELECT COUNT(*) FROM Topics WHERE Id = $topicId;";
    topicCommand.Parameters.AddWithValue("$topicId", request.TopicId);

    if (Convert.ToInt32(topicCommand.ExecuteScalar()) == 0)
    {
        return Results.BadRequest(new { message = "The selected topic does not exist." });
    }

    using var transaction = connection.BeginTransaction();

    using var guideCommand = connection.CreateCommand();
    guideCommand.Transaction = transaction;
    guideCommand.CommandText = """
        INSERT INTO Guides (TopicId, Name, StartInstruction, IsAvailable)
        VALUES ($topicId, $name, $startInstruction, $isAvailable);
        SELECT last_insert_rowid();
        """;
    guideCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    guideCommand.Parameters.AddWithValue("$name", name);
    guideCommand.Parameters.AddWithValue("$startInstruction", request.StartInstruction!.Trim());
    guideCommand.Parameters.AddWithValue("$isAvailable", request.IsAvailable ? 1 : 0);
    var guideId = Convert.ToInt64(guideCommand.ExecuteScalar());

    var savedSteps = SaveGuideSteps(connection, transaction, guideId, request.Steps);

    transaction.Commit();

    return Results.Created($"/api/guides/{guideId}",
        new GuideResponse(
            guideId,
            request.TopicId,
            name,
            request.StartInstruction?.Trim(),
            request.IsAvailable,
            savedSteps));
});

static List<GuideStepResponse> SaveGuideSteps(SqliteConnection connection, SqliteTransaction transaction, long guideId, List<CreateGuideStepRequest> steps)
{
    var existingIds = new HashSet<long>();
    using (var existingCommand = connection.CreateCommand())
    {
        existingCommand.Transaction = transaction;
        existingCommand.CommandText = "SELECT Id FROM GuideSteps WHERE GuideId = $guideId;";
        existingCommand.Parameters.AddWithValue("$guideId", guideId);
        using var reader = existingCommand.ExecuteReader();
        while (reader.Read()) existingIds.Add(reader.GetInt64(0));
    }

    var requestedExistingIds = steps.Where(step => step.Id.HasValue).Select(step => step.Id!.Value).ToList();
    if (requestedExistingIds.Count != requestedExistingIds.Distinct().Count() ||
        requestedExistingIds.Any(id => !existingIds.Contains(id)))
        throw new InvalidOperationException("One or more step IDs do not belong to this guide.");

    // Move orders out of the way first so the unique (GuideId, StepOrder) constraint
    // does not collide while existing steps are reordered.
    using (var parkCommand = connection.CreateCommand())
    {
        parkCommand.Transaction = transaction;
        parkCommand.CommandText = "UPDATE GuideSteps SET StepOrder = StepOrder + 1000000 WHERE GuideId = $guideId;";
        parkCommand.Parameters.AddWithValue("$guideId", guideId);
        parkCommand.ExecuteNonQuery();
    }

    var keptIds = new HashSet<long>();
    var result = new List<GuideStepResponse>();

    for (var index = 0; index < steps.Count; index++)
    {
        var step = steps[index];
        var stepOrder = index + 1;
        long stepId;

        if (step.Id.HasValue)
        {
            stepId = step.Id.Value;
            using var updateCommand = connection.CreateCommand();
            updateCommand.Transaction = transaction;
            updateCommand.CommandText = """
                UPDATE GuideSteps
                SET StepOrder = $stepOrder,
                    Selector = $selector,
                    TargetType = $targetType,
                    Runtime = $runtime,
                    WindowsTarget = $windowsTarget,
                    Instruction = $instruction,
                    ScreenName = $screenName,
                    FrameTarget = $frameTarget,
                    ValidationEngine = $validationEngine,
                    ValidationExpression = $validationExpression,
                    ValidationErrorMessage = $validationErrorMessage,
                    ValidationBuilderType = $validationBuilderType,
                    ValidationBuilderValue = $validationBuilderValue
                WHERE Id = $stepId AND GuideId = $guideId;
                """;
            updateCommand.Parameters.AddWithValue("$stepId", stepId);
            updateCommand.Parameters.AddWithValue("$guideId", guideId);
            updateCommand.Parameters.AddWithValue("$stepOrder", stepOrder);
            var runtime = NormalizeRuntime(step.Runtime);
            var targetType = NormalizeTargetType(step.TargetType);
            updateCommand.Parameters.AddWithValue("$selector", runtime == "web" && targetType == "element" ? step.Selector?.Trim() ?? "" : "");
            updateCommand.Parameters.AddWithValue("$targetType", targetType);
            updateCommand.Parameters.AddWithValue("$runtime", runtime);
            updateCommand.Parameters.AddWithValue("$windowsTarget", runtime == "windows" && targetType == "element" ? JsonSerializer.Serialize(step.WindowsTarget) : DBNull.Value);
            updateCommand.Parameters.AddWithValue("$instruction", step.Instruction.Trim());
            updateCommand.Parameters.AddWithValue("$screenName", string.IsNullOrWhiteSpace(step.ScreenName) ? DBNull.Value : step.ScreenName.Trim());
            updateCommand.Parameters.AddWithValue("$frameTarget", step.Frame is null ? DBNull.Value : JsonSerializer.Serialize(step.Frame));
            updateCommand.Parameters.AddWithValue("$validationEngine", (object?)step.Validation?.Engine ?? DBNull.Value);
            updateCommand.Parameters.AddWithValue("$validationExpression", (object?)step.Validation?.Expression ?? DBNull.Value);
            updateCommand.Parameters.AddWithValue("$validationErrorMessage", (object?)step.Validation?.ErrorMessage ?? DBNull.Value);
            updateCommand.Parameters.AddWithValue("$validationBuilderType", (object?)step.Validation?.BuilderType ?? DBNull.Value);
            updateCommand.Parameters.AddWithValue("$validationBuilderValue", (object?)step.Validation?.BuilderValue ?? DBNull.Value);
            updateCommand.ExecuteNonQuery();
        }
        else
        {
            using var insertCommand = connection.CreateCommand();
            insertCommand.Transaction = transaction;
            insertCommand.CommandText = """
                INSERT INTO GuideSteps (GuideId, StepOrder, Selector, TargetType, Runtime, WindowsTarget, Instruction, ScreenName, FrameTarget, ValidationEngine, ValidationExpression, ValidationErrorMessage, ValidationBuilderType, ValidationBuilderValue)
                VALUES ($guideId, $stepOrder, $selector, $targetType, $runtime, $windowsTarget, $instruction, $screenName, $frameTarget, $validationEngine, $validationExpression, $validationErrorMessage, $validationBuilderType, $validationBuilderValue);
                SELECT last_insert_rowid();
                """;
            insertCommand.Parameters.AddWithValue("$guideId", guideId);
            insertCommand.Parameters.AddWithValue("$stepOrder", stepOrder);
            var runtime = NormalizeRuntime(step.Runtime);
            var targetType = NormalizeTargetType(step.TargetType);
            insertCommand.Parameters.AddWithValue("$selector", runtime == "web" && targetType == "element" ? step.Selector?.Trim() ?? "" : "");
            insertCommand.Parameters.AddWithValue("$targetType", targetType);
            insertCommand.Parameters.AddWithValue("$runtime", runtime);
            insertCommand.Parameters.AddWithValue("$windowsTarget", runtime == "windows" && targetType == "element" ? JsonSerializer.Serialize(step.WindowsTarget) : DBNull.Value);
            insertCommand.Parameters.AddWithValue("$instruction", step.Instruction.Trim());
            insertCommand.Parameters.AddWithValue("$screenName", string.IsNullOrWhiteSpace(step.ScreenName) ? DBNull.Value : step.ScreenName.Trim());
            insertCommand.Parameters.AddWithValue("$frameTarget", step.Frame is null ? DBNull.Value : JsonSerializer.Serialize(step.Frame));
            insertCommand.Parameters.AddWithValue("$validationEngine", (object?)step.Validation?.Engine ?? DBNull.Value);
            insertCommand.Parameters.AddWithValue("$validationExpression", (object?)step.Validation?.Expression ?? DBNull.Value);
            insertCommand.Parameters.AddWithValue("$validationErrorMessage", (object?)step.Validation?.ErrorMessage ?? DBNull.Value);
            insertCommand.Parameters.AddWithValue("$validationBuilderType", (object?)step.Validation?.BuilderType ?? DBNull.Value);
            insertCommand.Parameters.AddWithValue("$validationBuilderValue", (object?)step.Validation?.BuilderValue ?? DBNull.Value);
            stepId = Convert.ToInt64(insertCommand.ExecuteScalar());
        }

        keptIds.Add(stepId);
        var savedRuntime = NormalizeRuntime(step.Runtime);
        var savedTargetType = NormalizeTargetType(step.TargetType);
        result.Add(new GuideStepResponse(stepId, stepOrder, savedRuntime == "web" && savedTargetType == "element" ? step.Selector?.Trim() ?? "" : "", savedTargetType, step.Instruction.Trim(), string.IsNullOrWhiteSpace(step.ScreenName) ? null : step.ScreenName.Trim(), step.Frame, step.Validation, savedRuntime, savedRuntime == "windows" && savedTargetType == "element" ? step.WindowsTarget : null));
    }

    foreach (var removedId in existingIds.Except(keptIds))
    {
        using var deleteCommand = connection.CreateCommand();
        deleteCommand.Transaction = transaction;
        deleteCommand.CommandText = "DELETE FROM GuideSteps WHERE Id = $stepId AND GuideId = $guideId;";
        deleteCommand.Parameters.AddWithValue("$stepId", removedId);
        deleteCommand.Parameters.AddWithValue("$guideId", guideId);
        deleteCommand.ExecuteNonQuery();
    }

    return result;
}

app.Run();

static string NormalizeRuntime(string? runtime)
    => string.Equals(runtime, "windows", StringComparison.OrdinalIgnoreCase) ? "windows" : "web";

static string NormalizeTargetType(string? targetType)
    => string.Equals(targetType, "none", StringComparison.OrdinalIgnoreCase) ? "none" : "element";

static bool IsValidStepTarget(CreateGuideStepRequest step)
{
    if (string.IsNullOrWhiteSpace(step.Instruction)) return false;

    var runtime = NormalizeRuntime(step.Runtime);
    var targetType = NormalizeTargetType(step.TargetType);

    if (targetType == "none")
        return step.WindowsTarget is null;

    if (runtime == "web")
        return !string.IsNullOrWhiteSpace(step.Selector) && step.WindowsTarget is null;

    if (step.WindowsTarget is null ||
        string.IsNullOrWhiteSpace(step.WindowsTarget.ProcessName) ||
        step.WindowsTarget.Window is null ||
        step.WindowsTarget.Element is null ||
        string.IsNullOrWhiteSpace(step.WindowsTarget.Element.ControlType))
        return false;

    return !string.IsNullOrWhiteSpace(step.WindowsTarget.Element.AutomationId) ||
           !string.IsNullOrWhiteSpace(step.WindowsTarget.Element.Name);
}

static bool IsValidStepValidation(ValidationRule? validation)
{
    if (validation is null) return true;
    if (string.IsNullOrWhiteSpace(validation.Expression) || string.IsNullOrWhiteSpace(validation.ErrorMessage)) return false;

    if (string.Equals(validation.Engine, "changed", StringComparison.OrdinalIgnoreCase))
        return string.Equals(validation.Expression, "__changed__", StringComparison.Ordinal);

    if (string.Equals(validation.Engine, "required", StringComparison.OrdinalIgnoreCase))
        return string.Equals(validation.Expression, "__required__", StringComparison.Ordinal);

    if (!string.Equals(validation.Engine, "regex", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(validation.Engine, "changed_regex", StringComparison.OrdinalIgnoreCase)) return false;

    try
    {
        _ = new Regex(validation.Expression, RegexOptions.None, TimeSpan.FromMilliseconds(250));
        return true;
    }
    catch (ArgumentException)
    {
        return false;
    }
}

static void InitializeDatabase(string databasePath, string schemaPath)
{
    Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);

    if (!File.Exists(schemaPath))
    {
        throw new FileNotFoundException("GWTP database schema was not found.", schemaPath);
    }

    using var connection = OpenConnection(databasePath);
    using var command = connection.CreateCommand();
    command.CommandText = File.ReadAllText(schemaPath);
    command.ExecuteNonQuery();
}

static void ApplyOneTimeMigration(SqliteConnection connection, string migrationId, Action migration)
{
    using (var tableCommand = connection.CreateCommand())
    {
        tableCommand.CommandText = """
            CREATE TABLE IF NOT EXISTS SchemaMigrations (
                Id TEXT PRIMARY KEY,
                AppliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """;
        tableCommand.ExecuteNonQuery();
    }

    using (var existsCommand = connection.CreateCommand())
    {
        existsCommand.CommandText = "SELECT 1 FROM SchemaMigrations WHERE Id = $id LIMIT 1;";
        existsCommand.Parameters.AddWithValue("$id", migrationId);
        if (existsCommand.ExecuteScalar() is not null) return;
    }

    migration();

    using var markCommand = connection.CreateCommand();
    markCommand.CommandText = "INSERT INTO SchemaMigrations (Id) VALUES ($id);";
    markCommand.Parameters.AddWithValue("$id", migrationId);
    markCommand.ExecuteNonQuery();
}

static void ApplySanityTestUsersMigration(string databasePath)
{
    const string migrationId = "20260921_sanity_test_users_v1";
    var testUsers = new (string Username, string DisplayName, string Password, string Role)[]
    {
        ("sanity.admin", "GWTP Sanity Admin", "Sanity2026!", "admin"),
        ("sanity.editor", "GWTP Sanity Editor", "Sanity2026!", "editor"),
        ("sanity.learner", "GWTP Sanity Learner", "Sanity2026!", "learner")
    };

    using var connection = OpenConnection(databasePath);
    ApplyOneTimeMigration(connection, migrationId, () =>
    {
        var passwordHasher = new PasswordHasher<object>();

        foreach (var testUser in testUsers)
        {
            using var transaction = connection.BeginTransaction();

            using var lookupCommand = connection.CreateCommand();
            lookupCommand.Transaction = transaction;
            lookupCommand.CommandText = "SELECT Id FROM Users WHERE Username = $username COLLATE NOCASE;";
            lookupCommand.Parameters.AddWithValue("$username", testUser.Username);
            var existingId = lookupCommand.ExecuteScalar();

            long userId;
            var passwordHash = passwordHasher.HashPassword(new object(), testUser.Password);

            if (existingId is null)
            {
                using var userCommand = connection.CreateCommand();
                userCommand.Transaction = transaction;
                userCommand.CommandText = """
                    INSERT INTO Users (Username, DisplayName, PasswordHash, IsActive)
                    VALUES ($username, $displayName, $passwordHash, 1);
                    SELECT last_insert_rowid();
                    """;
                userCommand.Parameters.AddWithValue("$username", testUser.Username);
                userCommand.Parameters.AddWithValue("$displayName", testUser.DisplayName);
                userCommand.Parameters.AddWithValue("$passwordHash", passwordHash);
                userId = Convert.ToInt64(userCommand.ExecuteScalar());
            }
            else
            {
                userId = Convert.ToInt64(existingId);
                using var userCommand = connection.CreateCommand();
                userCommand.Transaction = transaction;
                userCommand.CommandText = """
                    UPDATE Users
                    SET DisplayName = $displayName, PasswordHash = $passwordHash, IsActive = 1
                    WHERE Id = $id;
                    """;
                userCommand.Parameters.AddWithValue("$displayName", testUser.DisplayName);
                userCommand.Parameters.AddWithValue("$passwordHash", passwordHash);
                userCommand.Parameters.AddWithValue("$id", userId);
                userCommand.ExecuteNonQuery();
            }

            using var deleteRolesCommand = connection.CreateCommand();
            deleteRolesCommand.Transaction = transaction;
            deleteRolesCommand.CommandText = "DELETE FROM UserRoles WHERE UserId = $userId;";
            deleteRolesCommand.Parameters.AddWithValue("$userId", userId);
            deleteRolesCommand.ExecuteNonQuery();

            using var roleCommand = connection.CreateCommand();
            roleCommand.Transaction = transaction;
            roleCommand.CommandText = "INSERT INTO UserRoles (UserId, Role) VALUES ($userId, $role);";
            roleCommand.Parameters.AddWithValue("$userId", userId);
            roleCommand.Parameters.AddWithValue("$role", testUser.Role);
            roleCommand.ExecuteNonQuery();

            transaction.Commit();
        }
    });
}

static void ApplyDatabaseMigrations(string databasePath)
{
    using var connection = OpenConnection(databasePath);

    using var columnsCommand = connection.CreateCommand();
    columnsCommand.CommandText = "PRAGMA table_info(Guides);";

    using var reader = columnsCommand.ExecuteReader();
    var hasStartInstruction = false;

    while (reader.Read())
    {
        if (string.Equals(reader.GetString(1), "StartInstruction", StringComparison.OrdinalIgnoreCase))
        {
            hasStartInstruction = true;
            break;
        }
    }

    reader.Close();

    if (!hasStartInstruction)
    {
        using var migrationCommand = connection.CreateCommand();
        migrationCommand.CommandText = "ALTER TABLE Guides ADD COLUMN StartInstruction TEXT NOT NULL DEFAULT '';";
        migrationCommand.ExecuteNonQuery();
    }

    ApplyOneTimeMigration(connection, "20260926_start_instruction_neutral_v2", () =>
    {
        using var populateStartInstructionCommand = connection.CreateCommand();
        populateStartInstructionCommand.CommandText = """
            UPDATE Guides
            SET StartInstruction = 'פתח את המערכת והגע לנקודה שממנה מתחיל המדריך.'
            WHERE StartInstruction IS NULL
               OR TRIM(StartInstruction) = ''
               OR StartInstruction = 'Open the relevant system and navigate to the starting screen.'
               OR StartInstruction = 'פתח את המערכת הרלוונטית ועבור למסך ההתחלה.';
            """;
        populateStartInstructionCommand.ExecuteNonQuery();
    });

    var hasLegacyStartUrl = false;
    using (var legacyColumnsCommand = connection.CreateCommand())
    {
        legacyColumnsCommand.CommandText = "PRAGMA table_info(Guides);";
        using var legacyReader = legacyColumnsCommand.ExecuteReader();
        while (legacyReader.Read())
        {
            if (string.Equals(legacyReader.GetString(1), "StartUrl", StringComparison.OrdinalIgnoreCase))
            {
                hasLegacyStartUrl = true;
                break;
            }
        }
    }

    if (hasLegacyStartUrl)
    {
        using var removeLegacyColumnCommand = connection.CreateCommand();
        removeLegacyColumnCommand.CommandText = "ALTER TABLE Guides DROP COLUMN StartUrl;";
        removeLegacyColumnCommand.ExecuteNonQuery();
    }

    var guideStepColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using (var guideStepColumnsCommand = connection.CreateCommand())
    {
        guideStepColumnsCommand.CommandText = "PRAGMA table_info(GuideSteps);";
        using var guideStepReader = guideStepColumnsCommand.ExecuteReader();
        while (guideStepReader.Read()) guideStepColumns.Add(guideStepReader.GetString(1));
    }

    if (!guideStepColumns.Contains("FrameTarget"))
    {
        using var migrationCommand = connection.CreateCommand();
        migrationCommand.CommandText = "ALTER TABLE GuideSteps ADD COLUMN FrameTarget TEXT;";
        migrationCommand.ExecuteNonQuery();
    }

    var guideStepMigrations = new Dictionary<string, string>
    {
        ["ValidationEngine"] = "ALTER TABLE GuideSteps ADD COLUMN ValidationEngine TEXT;",
        ["ValidationExpression"] = "ALTER TABLE GuideSteps ADD COLUMN ValidationExpression TEXT;",
        ["ValidationErrorMessage"] = "ALTER TABLE GuideSteps ADD COLUMN ValidationErrorMessage TEXT;",
        ["ValidationBuilderType"] = "ALTER TABLE GuideSteps ADD COLUMN ValidationBuilderType TEXT;",
        ["ValidationBuilderValue"] = "ALTER TABLE GuideSteps ADD COLUMN ValidationBuilderValue TEXT;",
        ["ScreenName"] = "ALTER TABLE GuideSteps ADD COLUMN ScreenName TEXT;",
        ["TargetType"] = "ALTER TABLE GuideSteps ADD COLUMN TargetType TEXT NOT NULL DEFAULT 'element';",
        ["Runtime"] = "ALTER TABLE GuideSteps ADD COLUMN Runtime TEXT NOT NULL DEFAULT 'web';",
        ["WindowsTarget"] = "ALTER TABLE GuideSteps ADD COLUMN WindowsTarget TEXT;"
    };

    foreach (var migration in guideStepMigrations)
    {
        if (guideStepColumns.Contains(migration.Key)) continue;
        using var migrationCommand = connection.CreateCommand();
        migrationCommand.CommandText = migration.Value;
        migrationCommand.ExecuteNonQuery();
    }

    ApplyOneTimeMigration(connection, "20260926_guide_step_runtime_windows_target_v1", () =>
    {
        using var normalizeRuntimeCommand = connection.CreateCommand();
        normalizeRuntimeCommand.CommandText = """
            UPDATE GuideSteps
            SET Runtime = 'web'
            WHERE Runtime IS NULL OR TRIM(Runtime) = '';
            """;
        normalizeRuntimeCommand.ExecuteNonQuery();
    });

    var progressColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using (var progressColumnsCommand = connection.CreateCommand())
    {
        progressColumnsCommand.CommandText = "PRAGMA table_info(UserProgress);";
        using var progressReader = progressColumnsCommand.ExecuteReader();
        while (progressReader.Read()) progressColumns.Add(progressReader.GetString(1));
    }

    var progressMigrations = new Dictionary<string, string>
    {
        ["CurrentStepOrder"] = "ALTER TABLE UserProgress ADD COLUMN CurrentStepOrder INTEGER NOT NULL DEFAULT 1;",
        ["Status"] = "ALTER TABLE UserProgress ADD COLUMN Status TEXT NOT NULL DEFAULT 'InProgress';",
        ["StartedAt"] = "ALTER TABLE UserProgress ADD COLUMN StartedAt TEXT;",
        ["LastActivityAt"] = "ALTER TABLE UserProgress ADD COLUMN LastActivityAt TEXT;",
        ["CompletedAt"] = "ALTER TABLE UserProgress ADD COLUMN CompletedAt TEXT;"
    };

    foreach (var migration in progressMigrations)
    {
        if (progressColumns.Contains(migration.Key)) continue;
        using var migrationCommand = connection.CreateCommand();
        migrationCommand.CommandText = migration.Value;
        migrationCommand.ExecuteNonQuery();
    }

    using (var stepProgressMigration = connection.CreateCommand())
    {
        stepProgressMigration.CommandText = """
            CREATE TABLE IF NOT EXISTS UserStepProgress (
                UserId INTEGER NOT NULL,
                GuideId INTEGER NOT NULL,
                GuideStepId INTEGER NOT NULL,
                CompletedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (UserId, GuideStepId),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                FOREIGN KEY (GuideId) REFERENCES Guides(Id) ON DELETE CASCADE,
                FOREIGN KEY (GuideStepId) REFERENCES GuideSteps(Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_UserStepProgress_UserGuide
                ON UserStepProgress(UserId, GuideId);
            """;
        stepProgressMigration.ExecuteNonQuery();
    }

    ApplyOneTimeMigration(connection, "20260920_validation_regression_guide", () =>
    {
        const string topicName = "Demo CRM";
        const string guideName = "בדיקת כל חוקי הוולידציה";

        using var transaction = connection.BeginTransaction();

        using var topicCommand = connection.CreateCommand();
        topicCommand.Transaction = transaction;
        topicCommand.CommandText = """
            INSERT INTO Topics (Name)
            SELECT $name
            WHERE NOT EXISTS (SELECT 1 FROM Topics WHERE Name = $name COLLATE NOCASE);
            SELECT Id FROM Topics WHERE Name = $name COLLATE NOCASE ORDER BY Id LIMIT 1;
            """;
        topicCommand.Parameters.AddWithValue("$name", topicName);
        var topicId = Convert.ToInt64(topicCommand.ExecuteScalar());

        using var existingGuideCommand = connection.CreateCommand();
        existingGuideCommand.Transaction = transaction;
        existingGuideCommand.CommandText = """
            SELECT Id FROM Guides
            WHERE TopicId = $topicId AND Name = $guideName COLLATE NOCASE
            LIMIT 1;
            """;
        existingGuideCommand.Parameters.AddWithValue("$topicId", topicId);
        existingGuideCommand.Parameters.AddWithValue("$guideName", guideName);
        var existingGuideId = existingGuideCommand.ExecuteScalar();

        long guideId;
        if (existingGuideId is null)
        {
            using var guideCommand = connection.CreateCommand();
            guideCommand.Transaction = transaction;
            guideCommand.CommandText = """
                INSERT INTO Guides (TopicId, Name, StartInstruction, IsAvailable)
                VALUES ($topicId, $name, $startInstruction, 1);
                SELECT last_insert_rowid();
                """;
            guideCommand.Parameters.AddWithValue("$topicId", topicId);
            guideCommand.Parameters.AddWithValue("$name", guideName);
            guideCommand.Parameters.AddWithValue("$startInstruction", "פתח את המערכת והגע לנקודה שממנה מתחיל המדריך.");
            guideId = Convert.ToInt64(guideCommand.ExecuteScalar());
        }
        else
        {
            guideId = Convert.ToInt64(existingGuideId);
            using var clearSteps = connection.CreateCommand();
            clearSteps.Transaction = transaction;
            clearSteps.CommandText = "DELETE FROM GuideSteps WHERE GuideId = $guideId;";
            clearSteps.Parameters.AddWithValue("$guideId", guideId);
            clearSteps.ExecuteNonQuery();
        }

        var contentFrame = JsonSerializer.Serialize(
            new FrameTarget(false, null, "TargetContent", "ptifrmtgtframe", "TargetContent", "Main Content"));

        var steps = new (string Selector, string Instruction, ValidationRule Validation)[]
        {
            ("#site-name", "בדיקת שדה חובה: מחק את שם האתר ונסה לעבור הלאה. לאחר החסימה הזן ערך כלשהו.",
                new ValidationRule("required", "__required__", "יש להזין שם אתר לפני המעבר לשלב הבא.", "required", "")),
            ("#site-type", "בדיקת שווה לערך: בחר ערך שאינו סניף מכירות ונסה לעבור הלאה. לאחר מכן בחר סניף מכירות.",
                new ValidationRule("regex", "^branch$", "יש לבחור סניף מכירות לפני המעבר לשלב הבא.", "equals", "branch")),
            ("#site-type", "בדיקת שונה מערך: סניף מכירות צריך להיחסם. בחר סוג אתר אחר.",
                new ValidationRule("regex", "^(?!branch$).+$", "יש לבחור סוג אתר שאינו סניף מכירות.", "not_equals", "branch")),
            ("#site-name", "בדיקת מכיל: הזן שם שאינו מכיל TEST ונסה לעבור הלאה. לאחר מכן הזן שם שמכיל TEST.",
                new ValidationRule("regex", ".*TEST.*", "שם האתר חייב להכיל TEST.", "contains", "TEST")),
            ("#site-phone", "בדיקת שינוי: נסה לעבור הלאה בלי לשנות את מספר הטלפון. לאחר החסימה שנה את המספר.",
                new ValidationRule("changed", "__changed__", "יש לשנות את מספר הטלפון לפני המעבר לשלב הבא.", "changed", "")),
            ("#site-phone", "שנה את מספר הטלפון למספר חדש ותקין.",
                new ValidationRule("changed_regex", "^0\\d{1,2}-?\\d{7}$", "יש להזין מספר טלפון חדש ותקין.", "changed_regex", "^0\\d{1,2}-?\\d{7}$"))
        };

        for (var index = 0; index < steps.Length; index++)
        {
            using var stepCommand = connection.CreateCommand();
            stepCommand.Transaction = transaction;
            stepCommand.CommandText = """
                INSERT INTO GuideSteps
                    (GuideId, StepOrder, Selector, Instruction, FrameTarget,
                     ValidationEngine, ValidationExpression, ValidationErrorMessage,
                     ValidationBuilderType, ValidationBuilderValue)
                VALUES
                    ($guideId, $stepOrder, $selector, $instruction, $frameTarget,
                     $engine, $expression, $errorMessage, $builderType, $builderValue);
                """;
            stepCommand.Parameters.AddWithValue("$guideId", guideId);
            stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
            stepCommand.Parameters.AddWithValue("$selector", steps[index].Selector);
            stepCommand.Parameters.AddWithValue("$instruction", steps[index].Instruction);
            stepCommand.Parameters.AddWithValue("$frameTarget", contentFrame);
            stepCommand.Parameters.AddWithValue("$engine", steps[index].Validation.Engine);
            stepCommand.Parameters.AddWithValue("$expression", steps[index].Validation.Expression);
            stepCommand.Parameters.AddWithValue("$errorMessage", steps[index].Validation.ErrorMessage);
            stepCommand.Parameters.AddWithValue("$builderType", steps[index].Validation.BuilderType ?? "");
            stepCommand.Parameters.AddWithValue("$builderValue", steps[index].Validation.BuilderValue ?? "");
            stepCommand.ExecuteNonQuery();
        }

        transaction.Commit();
    });

    using var normalizeProgress = connection.CreateCommand();
    normalizeProgress.CommandText = "UPDATE UserProgress SET StartedAt = COALESCE(StartedAt, CURRENT_TIMESTAMP), LastActivityAt = COALESCE(LastActivityAt, CURRENT_TIMESTAMP);";
    normalizeProgress.ExecuteNonQuery();

}


static void ApplyDemoScreenNameMigration(string databasePath)
{
    using var connection = OpenConnection(databasePath);

    ApplyOneTimeMigration(connection, "20260921_demo_guide_screen_names", () =>
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE GuideSteps
            SET ScreenName = CASE
                WHEN StepOrder BETWEEN 1 AND 6 THEN 'אתר'
                WHEN StepOrder BETWEEN 7 AND 10 THEN 'פניה'
                WHEN StepOrder BETWEEN 11 AND 15 THEN 'לידים'
                WHEN StepOrder BETWEEN 16 AND 21 THEN '360'
                ELSE ScreenName
            END
            WHERE GuideId IN (
                SELECT g.Id
                FROM Guides g
                INNER JOIN Topics t ON t.Id = g.TopicId
                WHERE t.Name = 'Demo CRM'
                  AND g.Name = 'תרגול מלא - Demo CRM'
            )
              AND (ScreenName IS NULL OR TRIM(ScreenName) = '');
            """;
        command.ExecuteNonQuery();
    });
}


static void EnsureDemoSiteGuide(string databasePath)
{
    const string topicName = "Demo CRM";
    const string guideName = "תרגול מלא - Demo CRM";

    var steps = new (string Selector, string Instruction)[]
    {
        ("#site-code", "זהו קוד האתר במערכת. אין צורך לשנות אותו."),
        ("#site-name", "כאן מופיע שם האתר או הסניף."),
        ("#site-phone", "שנה את מספר הטלפון למספר חדש."),
        ("#site-type", "שנה את סוג האתר ל<strong>סניף מכירות</strong>."),
        ("#btn-save-site", "לחץ על <strong>שמור שינויים</strong> כדי לשמור את נתוני האתר. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>."),
        ("#btn-open-case-from-site", "לחץ על <strong>פתח פניה לאתר זה</strong>."),
        ("#case-category", "בחר קטגוריה מתאימה לפנייה, שאינה <strong>תקלות תקשורת ורשת</strong>."),
        ("#case-assigned", "עדכן את הנציג המטפל בפניה."),
        ("#case-subject", "עדכן את נושא הפניה. שים לב שהשרת מבצע ולידציה בעת השמירה."),
        ("#btn-save-case", "לחץ על <strong>עדכן פניה</strong>. אם קיימת שגיאת ולידציה, תקן אותה ועדכן שוב. אם העדכון הסתיים ללא שגיאות, לחץ על <strong>הבא</strong>."),
        ("#nav-leads", "עבור למסך <strong>לידים</strong>."),
        ("#lead-source", "בחר מקור ליד שאינו <strong>אתר אינטרנט</strong>."),
        ("#lead-interest", "בחר מוצר מבוקש שאינו <strong>Cloud CRM</strong>."),
        ("#lead-email", "בדוק שקיימת כתובת דוא״ל לפני השמירה."),
        ("#btn-save-lead", "לחץ על <strong>שמור ליד</strong>. אם השמירה נדחית, תקן את השדה המסומן ונסה שוב. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>."),
        ("#nav-360", "עבור למסך <strong>360</strong>."),
        ("#c360-tier", "בחר סיווג לקוח שאינו <strong>Platinum</strong>."),
        ("#c360-manager", "עדכן את מנהל תיק הלקוח."),
        ("#c360-mrr", "בדוק את המחזור החודשי. השרת דורש שהערך יכיל מספר."),
        ("#btn-save-360", "לחץ על <strong>שמור פרטי לקוח</strong>. תקן שגיאות ולידציה אם יוצגו. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>."),
        ("gwtp-grid:#c360-summary-body|4|\"בטיפול מומחה\"", "בטבלת הסיכום ניתן להתמקד גם בתא מסוים. כאן מסומן הסטטוס <strong>בטיפול מומחה</strong>.")
    };

    using var connection = OpenConnection(databasePath);
    using var transaction = connection.BeginTransaction();

    using var topicCommand = connection.CreateCommand();
    topicCommand.Transaction = transaction;
    topicCommand.CommandText = """
        INSERT INTO Topics (Name)
        SELECT $name
        WHERE NOT EXISTS (SELECT 1 FROM Topics WHERE Name = $name COLLATE NOCASE);
        SELECT Id FROM Topics WHERE Name = $name COLLATE NOCASE ORDER BY Id LIMIT 1;
        """;
    topicCommand.Parameters.AddWithValue("$name", topicName);
    var topicId = Convert.ToInt64(topicCommand.ExecuteScalar());

    using var guideLookup = connection.CreateCommand();
    guideLookup.Transaction = transaction;
    guideLookup.CommandText = """
        SELECT Id FROM Guides
        WHERE TopicId = $topicId
          AND Name IN ('עדכון פרטי אתר', $guideName)
        ORDER BY CASE WHEN Name = $guideName THEN 0 ELSE 1 END, Id
        LIMIT 1;
        """;
    guideLookup.Parameters.AddWithValue("$topicId", topicId);
    guideLookup.Parameters.AddWithValue("$guideName", guideName);
    var existingGuideId = guideLookup.ExecuteScalar();

    if (existingGuideId is not null)
    {
        var existingDemoGuideId = Convert.ToInt64(existingGuideId);

        using var frameMigration = connection.CreateCommand();
        frameMigration.Transaction = transaction;
        frameMigration.CommandText = """
            UPDATE GuideSteps
            SET FrameTarget = $contentFrame
            WHERE GuideId = $guideId
              AND FrameTarget IS NULL
              AND Selector NOT IN ('#nav-site', '#nav-case', '#nav-leads', '#nav-360');

            UPDATE GuideSteps
            SET FrameTarget = $topFrame
            WHERE GuideId = $guideId
              AND FrameTarget IS NULL
              AND Selector IN ('#nav-site', '#nav-case', '#nav-leads', '#nav-360');
            """;
        frameMigration.Parameters.AddWithValue("$guideId", existingDemoGuideId);
        frameMigration.Parameters.AddWithValue("$contentFrame", JsonSerializer.Serialize(
            new FrameTarget(false, null, "TargetContent", "ptifrmtgtframe", "TargetContent", "Main Content")));
        frameMigration.Parameters.AddWithValue("$topFrame", JsonSerializer.Serialize(
            new FrameTarget(true, null, "", "", "", "")));
        frameMigration.ExecuteNonQuery();

        using (var leadInterestInstructionCommand = connection.CreateCommand())
        {
            leadInterestInstructionCommand.Transaction = transaction;
            leadInterestInstructionCommand.CommandText = """
                UPDATE GuideSteps
                SET Instruction = 'בחר מוצר מבוקש שאינו <strong>Cloud CRM</strong>.'
                WHERE GuideId = $guideId
                  AND Selector = '#lead-interest'
                  AND Instruction = 'שנה את המוצר המבוקש.';
                """;
            leadInterestInstructionCommand.Parameters.AddWithValue("$guideId", existingDemoGuideId);
            leadInterestInstructionCommand.ExecuteNonQuery();
        }

        var demoValidations = new (string Selector, string Engine, string Expression, string ErrorMessage, string BuilderType, string BuilderValue)[]
        {
            ("#site-phone", "changed", "__changed__", "יש לשנות את מספר הטלפון לפני המעבר לשלב הבא.", "changed", ""),
            ("#site-type", "regex", "^branch$", "יש לבחור סניף מכירות לפני המעבר לשלב הבא.", "equals", "branch"),
            ("#case-category", "regex", "^(?!network$).+$", "לא ניתן לבחור ב״תקלות תקשורת ורשת״. יש לבחור קטגוריה אחרת.", "not_equals", "network"),
            ("#case-assigned", "changed", "__changed__", "יש לשנות את הנציג המטפל לפני המעבר לשלב הבא.", "changed", ""),
            ("#case-subject", "changed", "__changed__", "יש לשנות את נושא הפנייה לפני המעבר לשלב הבא.", "changed", ""),
            ("#lead-source", "regex", "^(?!web$).+$", "לא ניתן לבחור ב״אתר אינטרנט״. יש לבחור מקור ליד אחר.", "not_equals", "web"),
            ("#lead-interest", "regex", "^(?!cloud_crm$).+$", "לא ניתן לבחור ב־Cloud CRM. יש לבחור מוצר אחר.", "not_equals", "cloud_crm"),
            ("#lead-email", "required", "__required__", "יש להזין כתובת דוא״ל לפני המעבר לשלב הבא.", "required", ""),
            ("#c360-tier", "regex", "^(?!platinum$).+$", "לא ניתן לבחור בסיווג Platinum. יש לבחור סיווג אחר.", "not_equals", "platinum"),
            ("#c360-manager", "changed", "__changed__", "יש לשנות את מנהל תיק הלקוח לפני המעבר לשלב הבא.", "changed", ""),
            ("#c360-mrr", "required", "__required__", "יש להזין מחזור חודשי לפני המעבר לשלב הבא.", "required", "")
        };

        foreach (var validation in demoValidations)
        {
            using var validationCommand = connection.CreateCommand();
            validationCommand.Transaction = transaction;
            validationCommand.CommandText = """
                UPDATE GuideSteps
                SET ValidationEngine = $engine,
                    ValidationExpression = $expression,
                    ValidationErrorMessage = $errorMessage,
                    ValidationBuilderType = $builderType,
                    ValidationBuilderValue = $builderValue
                WHERE GuideId = $guideId AND Selector = $selector;
                """;
            validationCommand.Parameters.AddWithValue("$guideId", existingDemoGuideId);
            validationCommand.Parameters.AddWithValue("$selector", validation.Selector);
            validationCommand.Parameters.AddWithValue("$engine", validation.Engine);
            validationCommand.Parameters.AddWithValue("$expression", validation.Expression);
            validationCommand.Parameters.AddWithValue("$errorMessage", validation.ErrorMessage);
            validationCommand.Parameters.AddWithValue("$builderType", validation.BuilderType);
            validationCommand.Parameters.AddWithValue("$builderValue", validation.BuilderValue);
            validationCommand.ExecuteNonQuery();
        }

        using (var caseNavigationMigration = connection.CreateCommand())
        {
            caseNavigationMigration.Transaction = transaction;
            caseNavigationMigration.CommandText = """
                UPDATE GuideSteps
                SET Selector = '#btn-open-case-from-site',
                    Instruction = 'לחץ על <strong>פתח פניה לאתר זה</strong>.',
                    FrameTarget = $contentFrame
                WHERE GuideId = $guideId
                  AND Selector = '#nav-case';
                """;
            caseNavigationMigration.Parameters.AddWithValue("$guideId", existingDemoGuideId);
            caseNavigationMigration.Parameters.AddWithValue("$contentFrame", JsonSerializer.Serialize(
                new FrameTarget(false, null, "TargetContent", "ptifrmtgtframe", "TargetContent", "Main Content")));
            caseNavigationMigration.ExecuteNonQuery();
        }

        var instructionMigrations = new (string Selector, string OldInstruction, string NewInstruction)[]
        {
            ("#c360-tier",
                "שנה את סיווג הלקוח.",
                "בחר סיווג לקוח שאינו <strong>Platinum</strong>."),
            ("#lead-source",
                "שנה את מקור הליד.",
                "בחר מקור ליד שאינו <strong>אתר אינטרנט</strong>."),
            ("#case-category",
                "בחר קטגוריה מתאימה לפניה.",
                "בחר קטגוריה מתאימה לפנייה, שאינה <strong>תקלות תקשורת ורשת</strong>."),
            ("#btn-save-site",
                "לחץ על <strong>שמור שינויים</strong> כדי לשמור את נתוני האתר.",
                "לחץ על <strong>שמור שינויים</strong> כדי לשמור את נתוני האתר. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>."),
            ("#btn-save-case",
                "לחץ על <strong>עדכן פניה</strong>. אם קיימת שגיאת ולידציה, תקן אותה ועדכן שוב.",
                "לחץ על <strong>עדכן פניה</strong>. אם קיימת שגיאת ולידציה, תקן אותה ועדכן שוב. אם העדכון הסתיים ללא שגיאות, לחץ על <strong>הבא</strong>."),
            ("#btn-save-lead",
                "לחץ על <strong>שמור ליד</strong>. אם השמירה נדחית, תקן את השדה המסומן ונסה שוב.",
                "לחץ על <strong>שמור ליד</strong>. אם השמירה נדחית, תקן את השדה המסומן ונסה שוב. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>."),
            ("#btn-save-360",
                "לחץ על <strong>שמור פרטי לקוח</strong>. תקן שגיאות ולידציה אם יוצגו.",
                "לחץ על <strong>שמור פרטי לקוח</strong>. תקן שגיאות ולידציה אם יוצגו. אם השמירה הסתיימה ללא שגיאות, לחץ על <strong>הבא</strong>.")
        };

        foreach (var migration in instructionMigrations)
        {
            using var instructionCommand = connection.CreateCommand();
            instructionCommand.Transaction = transaction;
            instructionCommand.CommandText = """
                UPDATE GuideSteps
                SET Instruction = $newInstruction
                WHERE GuideId = $guideId
                  AND Selector = $selector
                  AND Instruction = $oldInstruction;
                """;
            instructionCommand.Parameters.AddWithValue("$guideId", existingDemoGuideId);
            instructionCommand.Parameters.AddWithValue("$selector", migration.Selector);
            instructionCommand.Parameters.AddWithValue("$oldInstruction", migration.OldInstruction);
            instructionCommand.Parameters.AddWithValue("$newInstruction", migration.NewInstruction);
            instructionCommand.ExecuteNonQuery();
        }

        transaction.Commit();
        return;
    }

    using var guideCommand = connection.CreateCommand();
    guideCommand.Transaction = transaction;
    guideCommand.CommandText = """
        INSERT INTO Guides (TopicId, Name, StartInstruction, IsAvailable)
        VALUES ($topicId, $name, $startInstruction, 1);
        SELECT last_insert_rowid();
        """;
    guideCommand.Parameters.AddWithValue("$topicId", topicId);
    guideCommand.Parameters.AddWithValue("$name", guideName);
    guideCommand.Parameters.AddWithValue("$startInstruction", "פתח את המערכת והגע לנקודה שממנה מתחיל המדריך.");
    var guideId = Convert.ToInt64(guideCommand.ExecuteScalar());

    for (var index = 0; index < steps.Length; index++)
    {
        using var stepCommand = connection.CreateCommand();
        stepCommand.Transaction = transaction;
        stepCommand.CommandText = """
            INSERT INTO GuideSteps (GuideId, StepOrder, Selector, Instruction, FrameTarget, ValidationEngine, ValidationExpression, ValidationErrorMessage, ValidationBuilderType, ValidationBuilderValue)
            VALUES ($guideId, $stepOrder, $selector, $instruction, $frameTarget, $validationEngine, $validationExpression, $validationErrorMessage, $validationBuilderType, $validationBuilderValue);
            """;
        stepCommand.Parameters.AddWithValue("$guideId", guideId);
        stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
        stepCommand.Parameters.AddWithValue("$selector", steps[index].Selector);
        stepCommand.Parameters.AddWithValue("$instruction", steps[index].Instruction);
        stepCommand.Parameters.AddWithValue("$frameTarget", DBNull.Value);

        var seedValidation = steps[index].Selector switch
        {
            "#site-phone" => new ValidationRule("changed", "__changed__", "יש לשנות את מספר הטלפון לפני המעבר לשלב הבא.", "changed", ""),
            "#site-type" => new ValidationRule("regex", "^branch$", "יש לבחור סניף מכירות לפני המעבר לשלב הבא.", "equals", "branch"),
            "#case-category" => new ValidationRule("regex", "^(?!network$).+$", "לא ניתן לבחור ב״תקלות תקשורת ורשת״. יש לבחור קטגוריה אחרת.", "not_equals", "network"),
            "#case-assigned" => new ValidationRule("changed", "__changed__", "יש לשנות את הנציג המטפל לפני המעבר לשלב הבא.", "changed", ""),
            "#case-subject" => new ValidationRule("changed", "__changed__", "יש לשנות את נושא הפנייה לפני המעבר לשלב הבא.", "changed", ""),
            "#lead-source" => new ValidationRule("regex", "^(?!web$).+$", "לא ניתן לבחור ב״אתר אינטרנט״. יש לבחור מקור ליד אחר.", "not_equals", "web"),
            "#lead-interest" => new ValidationRule("regex", "^(?!cloud_crm$).+$", "לא ניתן לבחור ב־Cloud CRM. יש לבחור מוצר אחר.", "not_equals", "cloud_crm"),
            "#lead-email" => new ValidationRule("required", "__required__", "יש להזין כתובת דוא״ל לפני המעבר לשלב הבא.", "required", ""),
            "#c360-tier" => new ValidationRule("regex", "^(?!platinum$).+$", "לא ניתן לבחור בסיווג Platinum. יש לבחור סיווג אחר.", "not_equals", "platinum"),
            "#c360-manager" => new ValidationRule("changed", "__changed__", "יש לשנות את מנהל תיק הלקוח לפני המעבר לשלב הבא.", "changed", ""),
            "#c360-mrr" => new ValidationRule("required", "__required__", "יש להזין מחזור חודשי לפני המעבר לשלב הבא.", "required", ""),
            _ => null
        };
        stepCommand.Parameters.AddWithValue("$validationEngine", (object?)seedValidation?.Engine ?? DBNull.Value);
        stepCommand.Parameters.AddWithValue("$validationExpression", (object?)seedValidation?.Expression ?? DBNull.Value);
        stepCommand.Parameters.AddWithValue("$validationErrorMessage", (object?)seedValidation?.ErrorMessage ?? DBNull.Value);
        stepCommand.Parameters.AddWithValue("$validationBuilderType", (object?)seedValidation?.BuilderType ?? DBNull.Value);
        stepCommand.Parameters.AddWithValue("$validationBuilderValue", (object?)seedValidation?.BuilderValue ?? DBNull.Value);
        stepCommand.ExecuteNonQuery();
    }

    transaction.Commit();
}

static void EnsureDevelopmentAdmin(string databasePath)
{
    const string username = "admin";

    using var connection = OpenConnection(databasePath);

    using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = "SELECT Id FROM Users WHERE Username = $username;";
    existsCommand.Parameters.AddWithValue("$username", username);

    if (existsCommand.ExecuteScalar() is not null)
    {
        return;
    }

    var passwordHasher = new PasswordHasher<object>();
    var passwordHash = passwordHasher.HashPassword(new object(), "admin");

    using var transaction = connection.BeginTransaction();

    using var userCommand = connection.CreateCommand();
    userCommand.Transaction = transaction;
    userCommand.CommandText = """
        INSERT INTO Users (Username, DisplayName, PasswordHash, IsActive)
        VALUES ($username, $displayName, $passwordHash, 1);
        SELECT last_insert_rowid();
        """;
    userCommand.Parameters.AddWithValue("$username", username);
    userCommand.Parameters.AddWithValue("$displayName", "GWTP Admin");
    userCommand.Parameters.AddWithValue("$passwordHash", passwordHash);

    var userId = Convert.ToInt64(userCommand.ExecuteScalar());

    using var roleCommand = connection.CreateCommand();
    roleCommand.Transaction = transaction;
    roleCommand.CommandText = "INSERT INTO UserRoles (UserId, Role) VALUES ($userId, 'admin');";
    roleCommand.Parameters.AddWithValue("$userId", userId);
    roleCommand.ExecuteNonQuery();

    transaction.Commit();
}

static SqliteConnection OpenConnection(string databasePath)
{
    var connection = new SqliteConnection($"Data Source={databasePath}");
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = "PRAGMA foreign_keys = ON;";
    command.ExecuteNonQuery();

    return connection;
}

static string FindProjectRoot(string startPath)
{
    var directory = new DirectoryInfo(startPath);

    while (directory is not null)
    {
        if (Directory.Exists(Path.Combine(directory.FullName, "database")) &&
            Directory.Exists(Path.Combine(directory.FullName, "extension")))
        {
            return directory.FullName;
        }

        directory = directory.Parent;
    }

    throw new DirectoryNotFoundException("Could not locate the GWTP project root.");
}

sealed record UserResponse(
    long Id,
    string Username,
    string? DisplayName,
    bool IsActive,
    List<string> Roles);

sealed record CreateUserRequest(
    string Username,
    string? DisplayName,
    string Password,
    string Role);

sealed record UpdateUserRequest(
    string? DisplayName,
    string Role,
    bool IsActive,
    string? NewPassword);

sealed record CreateTopicRequest(string Name);

sealed record TopicResponse(
    long Id,
    string Name);

sealed record FrameTarget(
    bool IsTop,
    string? Url,
    string? Name,
    string? ElementId,
    string? ElementName,
    string? ElementTitle);

sealed record ValidationRule(
    string Engine,
    string Expression,
    string ErrorMessage,
    string? BuilderType,
    string? BuilderValue);

sealed record WindowsWindowDescriptor(
    string? AutomationId,
    string? Name);

sealed record WindowsElementDescriptor(
    string ControlType,
    string? AutomationId,
    string? Name);

sealed record WindowsAncestorDescriptor(
    string ControlType,
    string? AutomationId,
    string? Name);

sealed record WindowsTargetDescriptor(
    string ProcessName,
    WindowsWindowDescriptor Window,
    WindowsElementDescriptor Element,
    List<WindowsAncestorDescriptor> Ancestors);

sealed record CreateGuideStepRequest(
    long? Id,
    string? Selector,
    string? TargetType,
    string Instruction,
    string? ScreenName,
    FrameTarget? Frame,
    ValidationRule? Validation,
    string? Runtime,
    WindowsTargetDescriptor? WindowsTarget);

sealed record CreateGuideRequest(
    long TopicId,
    string Name,
    string? StartInstruction,
    bool IsAvailable,
    List<CreateGuideStepRequest> Steps);

sealed record GuideStepResponse(
    long Id,
    int StepOrder,
    string Selector,
    string TargetType,
    string Instruction,
    string? ScreenName,
    FrameTarget? Frame,
    ValidationRule? Validation,
    string Runtime,
    WindowsTargetDescriptor? WindowsTarget);

sealed record GuideResponse(
    long Id,
    long TopicId,
    string Name,
    string? StartInstruction,
    bool IsAvailable,
    List<GuideStepResponse> Steps);

sealed record LearnerGuideResponse(long Id, string Name, string ProgressStatus);

sealed record LearnerTopicResponse(
    long Id,
    string Name,
    List<LearnerGuideResponse> Guides);

sealed record ProgressMoveRequest(long GuideId, int Direction);

sealed record LoginRequest(string Username, string Password);

sealed record LoginResponse(
    long Id,
    string Username,
    string? DisplayName,
    List<string> Roles,
    string AccessToken);
