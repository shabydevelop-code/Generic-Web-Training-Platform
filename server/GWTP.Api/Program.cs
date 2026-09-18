using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

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
