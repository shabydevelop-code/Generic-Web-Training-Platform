using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using System.Security.Cryptography;

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
EnsureDevelopmentAdmin(databasePath);

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
    var username = request.Username?.Trim();
    var displayName = request.DisplayName?.Trim();
    var role = request.Role?.Trim().ToLowerInvariant();

    if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password) ||
        role is not ("editor" or "learner"))
    {
        return Results.BadRequest(new { message = "Display name, username, password and a valid role are required." });
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

editorGuides.MapPost("", (CreateGuideRequest request) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name) || request.TopicId <= 0 || request.Steps is null || request.Steps.Count == 0)
    {
        return Results.BadRequest(new { message = "Topic, guide name and at least one step are required." });
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
        INSERT INTO Guides (TopicId, Name, IsAvailable)
        VALUES ($topicId, $name, 0);
        SELECT last_insert_rowid();
        """;
    guideCommand.Parameters.AddWithValue("$topicId", request.TopicId);
    guideCommand.Parameters.AddWithValue("$name", name);
    var guideId = Convert.ToInt64(guideCommand.ExecuteScalar());

    for (var index = 0; index < request.Steps.Count; index++)
    {
        var step = request.Steps[index];

        using var stepCommand = connection.CreateCommand();
        stepCommand.Transaction = transaction;
        stepCommand.CommandText = """
            INSERT INTO GuideSteps (GuideId, StepOrder, Selector, Instruction)
            VALUES ($guideId, $stepOrder, $selector, $instruction);
            """;
        stepCommand.Parameters.AddWithValue("$guideId", guideId);
        stepCommand.Parameters.AddWithValue("$stepOrder", index + 1);
        stepCommand.Parameters.AddWithValue("$selector", step.Selector.Trim());
        stepCommand.Parameters.AddWithValue("$instruction", step.Instruction.Trim());
        stepCommand.ExecuteNonQuery();
    }

    transaction.Commit();

    return Results.Created($"/api/guides/{guideId}",
        new GuideResponse(
            guideId,
            request.TopicId,
            name,
            false,
            request.Steps.Select((step, index) =>
                new GuideStepResponse(index + 1, step.Selector.Trim(), step.Instruction.Trim()))
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

sealed record CreateGuideStepRequest(
    string Selector,
    string Instruction);

sealed record CreateGuideRequest(
    long TopicId,
    string Name,
    List<CreateGuideStepRequest> Steps);

sealed record GuideStepResponse(
    int StepOrder,
    string Selector,
    string Instruction);

sealed record GuideResponse(
    long Id,
    long TopicId,
    string Name,
    bool IsAvailable,
    List<GuideStepResponse> Steps);

sealed record LoginRequest(string Username, string Password);

sealed record LoginResponse(
    long Id,
    string Username,
    string? DisplayName,
    List<string> Roles,
    string AccessToken);
