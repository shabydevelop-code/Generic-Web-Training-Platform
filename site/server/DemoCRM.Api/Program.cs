using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5100");

var app = builder.Build();

var siteRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", ".."));
var databaseDirectory = Path.Combine(siteRoot, "database");
var databasePath = Path.Combine(databaseDirectory, "demo-crm.db");

Directory.CreateDirectory(databaseDirectory);

var SiteFormStates = new Dictionary<string, SiteFormState>();

var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = databasePath,
    ForeignKeys = true
}.ToString();

InitializeDatabase(connectionString);

app.UseDefaultFiles(new DefaultFilesOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(siteRoot),
    DefaultFileNames = new List<string> { "site.html" }
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(siteRoot)
});

var extensionIconsPath = Path.GetFullPath(Path.Combine(siteRoot, "..", "extension", "icons"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(extensionIconsPath),
    RequestPath = "/icons"
});

app.MapGet("/api/health", () => Results.Ok(new
{
    service = "DemoCRM.Api",
    status = "ok"
}));

app.MapGet("/api/sites/{id:long}", (long id) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var siteCommand = connection.CreateCommand();
    siteCommand.CommandText = """
        SELECT Id, SystemId, Code, Name, Type, City, ContactName, Phone, Status
        FROM Sites
        WHERE Id = $id;
        """;
    siteCommand.Parameters.AddWithValue("$id", id);

    using var reader = siteCommand.ExecuteReader();
    if (!reader.Read())
    {
        return Results.NotFound();
    }

    var site = new
    {
        id = reader.GetInt64(0),
        systemId = reader.GetString(1),
        code = reader.GetString(2),
        name = reader.GetString(3),
        type = reader.GetString(4),
        city = reader.GetString(5),
        contactName = reader.GetString(6),
        phone = reader.GetString(7),
        status = reader.GetString(8)
    };

    reader.Close();

    using var assetsCommand = connection.CreateCommand();
    assetsCommand.CommandText = """
        SELECT SerialNumber, Description, IpAddress, Status, InstallationDate
        FROM Assets
        WHERE SiteId = $siteId
        ORDER BY Id;
        """;
    assetsCommand.Parameters.AddWithValue("$siteId", id);

    using var assetsReader = assetsCommand.ExecuteReader();
    var assets = new List<object>();

    while (assetsReader.Read())
    {
        assets.Add(new
        {
            serialNumber = assetsReader.GetString(0),
            description = assetsReader.GetString(1),
            ipAddress = assetsReader.GetString(2),
            status = assetsReader.GetString(3),
            installationDate = assetsReader.GetString(4)
        });
    }

    return Results.Ok(new
    {
        site.id,
        site.systemId,
        site.code,
        site.name,
        site.type,
        site.city,
        site.contactName,
        site.phone,
        site.status,
        assets
    });
});



app.MapPost("/site/type-change", async (HttpRequest request) =>
{
    var form = await request.ReadFormAsync();

    var state = new SiteFormState(
        form["code"].ToString(),
        form["name"].ToString(),
        form["type"].ToString(),
        form["city"].ToString(),
        form["contactName"].ToString(),
        form["phone"].ToString());

    var token = Guid.NewGuid().ToString("N");
    SiteFormStates[token] = state;

    var messageQuery = state.Type == "branch"
        ? $"&message={Uri.EscapeDataString("בחרת ב\"סניף מכירות\"")}"
        : "";

    return Results.Redirect($"/site.html?state={Uri.EscapeDataString(token)}{messageQuery}");
});

app.MapGet("/api/site-state/{token}", (string token) =>
{
    return SiteFormStates.TryGetValue(token, out var state)
        ? Results.Ok(state)
        : Results.NotFound();
});

app.MapPut("/api/sites/{id:long}", (long id, UpdateSiteRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new { message = "Site code and name are required." });
    }

    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = """
        UPDATE Sites
        SET Code = $code,
            Name = $name,
            Type = $type,
            City = $city,
            ContactName = $contactName,
            Phone = $phone
        WHERE Id = $id;
        """;
    command.Parameters.AddWithValue("$id", id);
    command.Parameters.AddWithValue("$code", request.Code.Trim());
    command.Parameters.AddWithValue("$name", request.Name.Trim());
    command.Parameters.AddWithValue("$type", request.Type?.Trim() ?? "");
    command.Parameters.AddWithValue("$city", request.City?.Trim() ?? "");
    command.Parameters.AddWithValue("$contactName", request.ContactName?.Trim() ?? "");
    command.Parameters.AddWithValue("$phone", request.Phone?.Trim() ?? "");

    if (command.ExecuteNonQuery() == 0)
    {
        return Results.NotFound();
    }

    return Results.Ok(new { id, saved = true });
});

app.Run();

static void InitializeDatabase(string connectionString)
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = """
        CREATE TABLE IF NOT EXISTS Sites (
            Id INTEGER PRIMARY KEY,
            SystemId TEXT NOT NULL,
            Code TEXT NOT NULL,
            Name TEXT NOT NULL,
            Type TEXT NOT NULL,
            City TEXT NOT NULL,
            ContactName TEXT NOT NULL,
            Phone TEXT NOT NULL,
            Status TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Assets (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            SiteId INTEGER NOT NULL,
            SerialNumber TEXT NOT NULL,
            Description TEXT NOT NULL,
            IpAddress TEXT NOT NULL,
            Status TEXT NOT NULL,
            InstallationDate TEXT NOT NULL,
            FOREIGN KEY (SiteId) REFERENCES Sites(Id) ON DELETE CASCADE
        );

        INSERT OR IGNORE INTO Sites
            (Id, SystemId, Code, Name, Type, City, ContactName, Phone, Status)
        VALUES
            (77402, 'SITE-77402', 'TLV-CENTER-01', 'מגדל שלום - תל אביב', 'hq',
             'תל אביב - אחד העם 9', 'ישראל ישראלי', '03-5551234', 'active');

        INSERT INTO Assets (SiteId, SerialNumber, Description, IpAddress, Status, InstallationDate)
        SELECT 77402, 'SN-99201', 'נתב תקשורת Enterprise Core Router', '10.120.4.1', 'active', '12/01/2024'
        WHERE NOT EXISTS (SELECT 1 FROM Assets WHERE SerialNumber = 'SN-99201');

        INSERT INTO Assets (SiteId, SerialNumber, Description, IpAddress, Status, InstallationDate)
        SELECT 77402, 'SN-88142', 'מתג מרכזי PoE Switch 48 Ports', '10.120.4.2', 'active', '15/02/2024'
        WHERE NOT EXISTS (SELECT 1 FROM Assets WHERE SerialNumber = 'SN-88142');

        INSERT INTO Assets (SiteId, SerialNumber, Description, IpAddress, Status, InstallationDate)
        SELECT 77402, 'SN-44310', 'מודם גיבוי סלולרי LTE Backup', '10.120.4.5', 'pending', '01/06/2024'
        WHERE NOT EXISTS (SELECT 1 FROM Assets WHERE SerialNumber = 'SN-44310');
        """;
    command.ExecuteNonQuery();
}


sealed record UpdateSiteRequest(
    string Code,
    string Name,
    string? Type,
    string? City,
    string? ContactName,
    string? Phone);


sealed record SiteFormState(
    string Code,
    string Name,
    string Type,
    string City,
    string ContactName,
    string Phone);
