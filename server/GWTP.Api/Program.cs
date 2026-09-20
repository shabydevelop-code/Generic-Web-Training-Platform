using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using System.Security.Cryptography;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

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

var projectRoot = FindProjectRoot(app.Environment.ContentRootPath);
var databaseDirectory = Path.Combine(projectRoot, "database");
var databasePath = Path.Combine(databaseDirectory, "GWTP.db");
var schemaPath = Path.Combine(databaseDirectory, "schema.sql");

InitializeDatabase(databasePath, schemaPath);
ApplyDatabaseMigrations(databasePath);
EnsureDevelopmentAdmin(databasePath);
EnsureDemoSiteGuide(databasePath);

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
        return Results.Forbid();
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
        SELECT Id, TopicId, Name, StartUrl, IsAvailable
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
    var startUrl = guideReader.IsDBNull(3) ? null : guideReader.GetString(3);
    var isAvailable = guideReader.GetInt64(4) == 1;
    guideReader.Close();

    using var stepsCommand = connection.CreateCommand();
    stepsCommand.CommandText = """
        SELECT StepOrder, Selector, Instruction, FrameTarget
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
            stepsReader.GetInt32(0),
            stepsReader.GetString(1),
            stepsReader.GetString(2),
            stepsReader.IsDBNull(3) ? null : JsonSerializer.Deserialize<FrameTarget>(stepsReader.GetString(3))));
    }

    return Results.Ok(new GuideResponse(guideId, topicId, name, startUrl, isAvailable, steps));
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
        return Results.Forbid();
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
        return Results.Forbid();
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
        SELECT Id, TopicId, Name, StartUrl, IsAvailable
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
    var startUrl = guideReader.IsDBNull(3) ? null : guideReader.GetString(3);
    var isAvailable = guideReader.GetInt64(4) == 1;
    guideReader.Close();

    using var stepsCommand = connection.CreateCommand();
    stepsCommand.CommandText = """
        SELECT StepOrder, Selector, Instruction, FrameTarget
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
            stepsReader.GetInt32(0),
            stepsReader.GetString(1),
            stepsReader.GetString(2),
            stepsReader.IsDBNull(3) ? null : JsonSerializer.Deserialize<FrameTarget>(stepsReader.GetString(3))));
    }

    return Results.Ok(new GuideResponse(guideId, topicId, name, startUrl, isAvailable, steps));
});

editorGuides.MapPut("/{id:long}", (long id, CreateGuideRequest request) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(request.StartUrl) || request.TopicId <= 0 || request.Steps is null)
        return Results.BadRequest(new { message = "Topic, guide name and start URL are required." });

    if (request.IsAvailable && request.Steps.Count == 0)
        return Results.BadRequest(new { message = "An available guide must contain at least one step." });

    if (request.Steps.Any(step => string.IsNullOrWhiteSpace(step.Selector) || string.IsNullOrWhiteSpace(step.Instruction)))
        return Results.BadRequest(new { message = "Every step requires a selector and instruction." });

    using var connection = OpenConnection(databasePath);

    using var topicCommand = connection.CreateCommand();
    topicCommand.CommandText = "SELECT COUNT(*) FROM Topics WHERE Id = $topicId;";
    topicCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    if (Convert.ToInt32(topicCommand.ExecuteScalar()) == 0)
        return Results.BadRequest(new { message = "The selected topic does not exist." });

    using var transaction = connection.BeginTransaction();

    using var guideCommand = connection.CreateCommand();
    guideCommand.Transaction = transaction;
    guideCommand.CommandText = "UPDATE Guides SET TopicId = $topicId, Name = $name, StartUrl = $startUrl, IsAvailable = $isAvailable WHERE Id = $id;";
    guideCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    guideCommand.Parameters.AddWithValue("$name", name);
    guideCommand.Parameters.AddWithValue("$startUrl", (object?)request.StartUrl?.Trim() ?? DBNull.Value);
    guideCommand.Parameters.AddWithValue("$isAvailable", request.IsAvailable ? 1 : 0);
    guideCommand.Parameters.AddWithValue("$id", id);
    if (guideCommand.ExecuteNonQuery() == 0)
    {
        transaction.Rollback();
        return Results.NotFound();
    }

    using var deleteStepsCommand = connection.CreateCommand();
    deleteStepsCommand.Transaction = transaction;
    deleteStepsCommand.CommandText = "DELETE FROM GuideSteps WHERE GuideId = $guideId;";
    deleteStepsCommand.Parameters.AddWithValue("$guideId", id);
    deleteStepsCommand.ExecuteNonQuery();

    for (var index = 0; index < request.Steps.Count; index++)
    {
        var step = request.Steps[index];
        using var stepCommand = connection.CreateCommand();
        stepCommand.Transaction = transaction;
        stepCommand.CommandText = """
            INSERT INTO GuideSteps (GuideId, StepOrder, Selector, Instruction, FrameTarget)
            VALUES ($guideId, $stepOrder, $selector, $instruction, $frameTarget);
            """;
        stepCommand.Parameters.AddWithValue("$guideId", id);
        stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
        stepCommand.Parameters.AddWithValue("$selector", step.Selector.Trim());
        stepCommand.Parameters.AddWithValue("$instruction", step.Instruction.Trim());
        stepCommand.Parameters.AddWithValue("$frameTarget", step.Frame is null ? DBNull.Value : JsonSerializer.Serialize(step.Frame));
        stepCommand.ExecuteNonQuery();
    }

    transaction.Commit();

    return Results.Ok(new GuideResponse(
        id,
        request.TopicId,
        name,
        request.StartUrl?.Trim(),
        request.IsAvailable,
        request.Steps.Select((step, index) =>
            new GuideStepResponse(index + 1, step.Selector.Trim(), step.Instruction.Trim(), step.Frame))
            .ToList()));
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

    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(request.StartUrl) || request.TopicId <= 0 || request.Steps is null)
    {
        return Results.BadRequest(new { message = "Topic, guide name and start URL are required." });
    }

    if (request.IsAvailable && request.Steps.Count == 0)
    {
        return Results.BadRequest(new { message = "An available guide must contain at least one step." });
    }

    if (request.Steps.Any(step =>
        string.IsNullOrWhiteSpace(step.Selector) ||
        string.IsNullOrWhiteSpace(step.Instruction)))
    {
        return Results.BadRequest(new { message = "Every step requires a selector and instruction." });
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
        INSERT INTO Guides (TopicId, Name, StartUrl, IsAvailable)
        VALUES ($topicId, $name, $startUrl, $isAvailable);
        SELECT last_insert_rowid();
        """;
    guideCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    guideCommand.Parameters.AddWithValue("$name", name);
    guideCommand.Parameters.AddWithValue("$isAvailable", request.IsAvailable ? 1 : 0);
    var guideId = Convert.ToInt64(guideCommand.ExecuteScalar());

    for (var index = 0; index < request.Steps.Count; index++)
    {
        var step = request.Steps[index];

        using var stepCommand = connection.CreateCommand();
        stepCommand.Transaction = transaction;
        stepCommand.CommandText = """
            INSERT INTO GuideSteps (GuideId, StepOrder, Selector, Instruction, FrameTarget)
            VALUES ($guideId, $stepOrder, $selector, $instruction, $frameTarget);
            """;
        stepCommand.Parameters.AddWithValue("$guideId", guideId);
        stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
        stepCommand.Parameters.AddWithValue("$selector", step.Selector.Trim());
        stepCommand.Parameters.AddWithValue("$instruction", step.Instruction.Trim());
        stepCommand.Parameters.AddWithValue("$frameTarget", step.Frame is null ? DBNull.Value : JsonSerializer.Serialize(step.Frame));
        stepCommand.ExecuteNonQuery();
    }

    transaction.Commit();

    return Results.Created($"/api/guides/{guideId}",
        new GuideResponse(
            guideId,
            request.TopicId,
            name,
            request.StartUrl?.Trim(),
            request.IsAvailable,
            request.Steps.Select((step, index) =>
                new GuideStepResponse(index + 1, step.Selector.Trim(), step.Instruction.Trim(), step.Frame))
                .ToList()));
});

app.Run();

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

static void ApplyDatabaseMigrations(string databasePath)
{
    using var connection = OpenConnection(databasePath);

    using var columnsCommand = connection.CreateCommand();
    columnsCommand.CommandText = "PRAGMA table_info(Guides);";

    using var reader = columnsCommand.ExecuteReader();
    var hasStartUrl = false;

    while (reader.Read())
    {
        if (string.Equals(reader.GetString(1), "StartUrl", StringComparison.OrdinalIgnoreCase))
        {
            hasStartUrl = true;
            break;
        }
    }

    reader.Close();

    if (!hasStartUrl)
    {
        using var migrationCommand = connection.CreateCommand();
        migrationCommand.CommandText = "ALTER TABLE Guides ADD COLUMN StartUrl TEXT;";
        migrationCommand.ExecuteNonQuery();
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

    using var normalizeProgress = connection.CreateCommand();
    normalizeProgress.CommandText = "UPDATE UserProgress SET StartedAt = COALESCE(StartedAt, CURRENT_TIMESTAMP), LastActivityAt = COALESCE(LastActivityAt, CURRENT_TIMESTAMP);";
    normalizeProgress.ExecuteNonQuery();

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
        ("#btn-save-site", "לחץ על <strong>שמור שינויים</strong> כדי לשמור את נתוני האתר."),
        ("#nav-case", "כעת עבור למסך <strong>פניה</strong>."),
        ("#case-category", "בחר קטגוריה מתאימה לפניה."),
        ("#case-assigned", "עדכן את הנציג המטפל בפניה."),
        ("#case-subject", "עדכן את נושא הפניה. שים לב שהשרת מבצע ולידציה בעת השמירה."),
        ("#btn-save-case", "לחץ על <strong>עדכן פניה</strong>. אם קיימת שגיאת ולידציה, תקן אותה ועדכן שוב."),
        ("#nav-leads", "עבור למסך <strong>לידים</strong>."),
        ("#lead-source", "שנה את מקור הליד."),
        ("#lead-interest", "שנה את המוצר המבוקש."),
        ("#lead-email", "בדוק את כתובת הדוא״ל. השרת יאכוף כתובת תקינה בעת השמירה."),
        ("#btn-save-lead", "לחץ על <strong>שמור ליד</strong>. אם השמירה נדחית, תקן את השדה המסומן ונסה שוב."),
        ("#nav-360", "עבור למסך <strong>360</strong>."),
        ("#c360-tier", "שנה את סיווג הלקוח."),
        ("#c360-manager", "עדכן את מנהל תיק הלקוח."),
        ("#c360-mrr", "בדוק את המחזור החודשי. השרת דורש שהערך יכיל מספר."),
        ("#btn-save-360", "לחץ על <strong>שמור פרטי לקוח</strong>. תקן שגיאות ולידציה אם יוצגו."),
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
        transaction.Commit();
        return;
    }

    using var guideCommand = connection.CreateCommand();
    guideCommand.Transaction = transaction;
    guideCommand.CommandText = """
        INSERT INTO Guides (TopicId, Name, StartUrl, IsAvailable)
        VALUES ($topicId, $name, $startUrl, 1);
        SELECT last_insert_rowid();
        """;
    guideCommand.Parameters.AddWithValue("$topicId", topicId);
    guideCommand.Parameters.AddWithValue("$name", guideName);
    guideCommand.Parameters.AddWithValue("$startUrl", "http://localhost:5100/site.html");
    var guideId = Convert.ToInt64(guideCommand.ExecuteScalar());

    for (var index = 0; index < steps.Length; index++)
    {
        using var stepCommand = connection.CreateCommand();
        stepCommand.Transaction = transaction;
        stepCommand.CommandText = """
            INSERT INTO GuideSteps (GuideId, StepOrder, Selector, Instruction, FrameTarget)
            VALUES ($guideId, $stepOrder, $selector, $instruction, $frameTarget);
            """;
        stepCommand.Parameters.AddWithValue("$guideId", guideId);
        stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
        stepCommand.Parameters.AddWithValue("$selector", steps[index].Selector);
        stepCommand.Parameters.AddWithValue("$instruction", steps[index].Instruction);
        stepCommand.Parameters.AddWithValue("$frameTarget", DBNull.Value);
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

sealed record CreateGuideStepRequest(
    string Selector,
    string Instruction,
    FrameTarget? Frame);

sealed record CreateGuideRequest(
    long TopicId,
    string Name,
    string? StartUrl,
    bool IsAvailable,
    List<CreateGuideStepRequest> Steps);

sealed record GuideStepResponse(
    int StepOrder,
    string Selector,
    string Instruction,
    FrameTarget? Frame);

sealed record GuideResponse(
    long Id,
    long TopicId,
    string Name,
    string? StartUrl,
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
