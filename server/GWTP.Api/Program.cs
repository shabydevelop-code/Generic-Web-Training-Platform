using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;

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

    return Results.Ok(new LoginResponse(userId, username, displayName, roles));
});

app.MapPost("/api/users", (CreateUserRequest request) =>
{
    var username = request.Username?.Trim();
    var displayName = request.DisplayName?.Trim();
    var role = request.Role?.Trim().ToLowerInvariant();

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password) ||
        role is not ("editor" or "learner"))
    {
        return Results.BadRequest(new { message = "Username, password and a valid role are required." });
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

app.MapPut("/api/users/{id:long}", (long id, UpdateUserRequest request) =>
{
    var displayName = request.DisplayName?.Trim();
    var role = request.Role?.Trim().ToLowerInvariant();

    if (role is not ("editor" or "learner"))
    {
        return Results.BadRequest(new { message = "A valid role is required." });
    }

    using var connection = OpenConnection(databasePath);

    using var userLookup = connection.CreateCommand();
    userLookup.CommandText = "SELECT Username FROM Users WHERE Id = $id;";
    userLookup.Parameters.AddWithValue("$id", id);
    var username = userLookup.ExecuteScalar() as string;

    if (username is null)
    {
        return Results.NotFound();
    }

    if (string.Equals(username, "admin", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = "The development admin cannot be modified here." });
    }

    using var transaction = connection.BeginTransaction();

    using var userCommand = connection.CreateCommand();
    userCommand.Transaction = transaction;
    var passwordHash = string.IsNullOrWhiteSpace(request.NewPassword)
        ? null
        : new PasswordHasher<object>().HashPassword(new object(), request.NewPassword);

    userCommand.CommandText = """
        UPDATE Users
        SET DisplayName = $displayName,
            IsActive = $isActive,
            PasswordHash = COALESCE($passwordHash, PasswordHash)
        WHERE Id = $id;
        """;
    userCommand.Parameters.AddWithValue("$displayName", string.IsNullOrWhiteSpace(displayName) ? DBNull.Value : displayName);
    userCommand.Parameters.AddWithValue("$isActive", request.IsActive ? 1 : 0);
    userCommand.Parameters.AddWithValue("$passwordHash", passwordHash is null ? DBNull.Value : passwordHash);
    userCommand.Parameters.AddWithValue("$id", id);
    userCommand.ExecuteNonQuery();

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

    transaction.Commit();

    return Results.Ok(new UserResponse(id, username, displayName, request.IsActive, [role]));
});

app.MapGet("/api/users", () =>
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

sealed record LoginRequest(string Username, string Password);

sealed record LoginResponse(
    long Id,
    string Username,
    string? DisplayName,
    List<string> Roles);
