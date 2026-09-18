using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

var projectRoot = FindProjectRoot(app.Environment.ContentRootPath);
var databaseDirectory = Path.Combine(projectRoot, "database");
var databasePath = Path.Combine(databaseDirectory, "GWTP.db");
var schemaPath = Path.Combine(databaseDirectory, "schema.sql");

InitializeDatabase(databasePath, schemaPath);

app.MapGet("/api/health", () => Results.Ok(new
{
    service = "GWTP.Api",
    status = "ok"
}));

app.MapGet("/api/health/database", () =>
{
    using var connection = new SqliteConnection($"Data Source={databasePath}");
    connection.Open();

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

app.Run();

static void InitializeDatabase(string databasePath, string schemaPath)
{
    Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);

    if (!File.Exists(schemaPath))
    {
        throw new FileNotFoundException("GWTP database schema was not found.", schemaPath);
    }

    using var connection = new SqliteConnection($"Data Source={databasePath}");
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = File.ReadAllText(schemaPath);
    command.ExecuteNonQuery();
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
