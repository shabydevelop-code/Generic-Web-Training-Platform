using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5100");

var app = builder.Build();

var siteRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", ".."));
var databaseDirectory = Path.Combine(siteRoot, "database");
var databasePath = Path.Combine(databaseDirectory, "demo-crm.db");

Directory.CreateDirectory(databaseDirectory);

var SiteFormStates = new Dictionary<string, SiteFormState>();
var CaseFormStates = new Dictionary<string, CaseFormState>();
var LeadFormStates = new Dictionary<string, LeadFormState>();
var Customer360FormStates = new Dictionary<string, Customer360FormState>();

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



app.MapGet("/api/cases/{id:long}", (long id) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT Id, CaseNumber, Customer, Site, Category, Assigned, Sla, Subject, Notes, Status, Priority
        FROM Cases WHERE Id = $id;
        """;
    command.Parameters.AddWithValue("$id", id);
    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();
    var result = new { id = reader.GetInt64(0), caseNumber = reader.GetString(1), customer = reader.GetString(2), site = reader.GetString(3), category = reader.GetString(4), assigned = reader.GetString(5), sla = reader.GetString(6), subject = reader.GetString(7), notes = reader.GetString(8), status = reader.GetString(9), priority = reader.GetString(10) };
    reader.Close();
    using var historyCommand = connection.CreateCommand();
    historyCommand.CommandText = "SELECT OccurredAt, Actor, ActionType, Description FROM CaseHistory WHERE CaseId = $id ORDER BY Id;";
    historyCommand.Parameters.AddWithValue("$id", id);
    using var historyReader = historyCommand.ExecuteReader();
    var history = new List<object>();
    while (historyReader.Read()) history.Add(new { occurredAt = historyReader.GetString(0), actor = historyReader.GetString(1), actionType = historyReader.GetString(2), description = historyReader.GetString(3) });
    return Results.Ok(new { result.id, result.caseNumber, result.customer, result.site, result.category, result.assigned, result.sla, result.subject, result.notes, result.status, result.priority, history });
});

app.MapPut("/api/cases/{id:long}", (long id, UpdateCaseRequest request) =>
{
    var caseErrors = new Dictionary<string, string>();
    if (string.IsNullOrWhiteSpace(request.Customer)) caseErrors["case-customer"] = "יש להזין שם לקוח.";
    if (string.IsNullOrWhiteSpace(request.Category)) caseErrors["case-category"] = "יש לבחור קטגוריית פניה.";
    if (string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Trim().Length < 10) caseErrors["case-subject"] = "נושא הפניה חייב להכיל לפחות 10 תווים.";
    if (caseErrors.Count > 0) return Results.BadRequest(new { message = "לא ניתן לשמור את הפניה. יש לתקן את השדות המסומנים.", errors = caseErrors });
    using var connection = new SqliteConnection(connectionString); connection.Open(); using var command = connection.CreateCommand();
    command.CommandText = "UPDATE Cases SET Customer=$customer, Site=$site, Category=$category, Assigned=$assigned, Subject=$subject, Notes=$notes WHERE Id=$id;";
    command.Parameters.AddWithValue("$id", id); command.Parameters.AddWithValue("$customer", request.Customer.Trim()); command.Parameters.AddWithValue("$site", request.Site?.Trim() ?? ""); command.Parameters.AddWithValue("$category", request.Category?.Trim() ?? ""); command.Parameters.AddWithValue("$assigned", request.Assigned?.Trim() ?? ""); command.Parameters.AddWithValue("$subject", request.Subject.Trim()); command.Parameters.AddWithValue("$notes", request.Notes?.Trim() ?? "");
    return command.ExecuteNonQuery() == 0 ? Results.NotFound() : Results.Ok(new { id, saved = true });
});

app.MapPost("/api/cases/{id:long}/escalate", (long id) =>
{
    using var connection = new SqliteConnection(connectionString); connection.Open(); using var command = connection.CreateCommand();
    command.CommandText = "UPDATE Cases SET Status = 'הוסלם לדרג ב' WHERE Id = $id;"; command.Parameters.AddWithValue("$id", id);
    return command.ExecuteNonQuery() == 0 ? Results.NotFound() : Results.Ok(new { id, escalated = true });
});


app.MapGet("/api/leads/{id:long}", (long id) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT Id, LeadNumber, Company, ContactName, Email, Source, Interest, Status, Potential
        FROM Leads WHERE Id = $id;
        """;
    command.Parameters.AddWithValue("$id", id);

    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();

    var lead = new
    {
        id = reader.GetInt64(0),
        leadNumber = reader.GetString(1),
        company = reader.GetString(2),
        contactName = reader.GetString(3),
        email = reader.GetString(4),
        source = reader.GetString(5),
        interest = reader.GetString(6),
        status = reader.GetString(7),
        potential = reader.GetString(8)
    };
    reader.Close();

    using var pipelineCommand = connection.CreateCommand();
    pipelineCommand.CommandText = """
        SELECT LeadNumber, Company, ContactName, SourceLabel, Stage, CreatedAt, StatusClass
        FROM LeadPipeline ORDER BY Id;
        """;
    using var pipelineReader = pipelineCommand.ExecuteReader();
    var pipeline = new List<object>();
    while (pipelineReader.Read())
    {
        pipeline.Add(new
        {
            leadNumber = pipelineReader.GetString(0),
            company = pipelineReader.GetString(1),
            contactName = pipelineReader.GetString(2),
            sourceLabel = pipelineReader.GetString(3),
            stage = pipelineReader.GetString(4),
            createdAt = pipelineReader.GetString(5),
            statusClass = pipelineReader.GetString(6)
        });
    }

    return Results.Ok(new
    {
        lead.id, lead.leadNumber, lead.company, lead.contactName, lead.email,
        lead.source, lead.interest, lead.status, lead.potential, pipeline
    });
});

app.MapPut("/api/leads/{id:long}", (long id, UpdateLeadRequest request) =>
{
    var leadErrors = new Dictionary<string, string>();
    if (string.IsNullOrWhiteSpace(request.Company) || request.Company.Trim().Length < 3) leadErrors["lead-company"] = "שם החברה חייב להכיל לפחות 3 תווים.";
    if (string.IsNullOrWhiteSpace(request.ContactName)) leadErrors["lead-contact-name"] = "יש להזין שם איש קשר.";
    if (string.IsNullOrWhiteSpace(request.Email) || !System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _)) leadErrors["lead-email"] = "יש להזין כתובת דוא״ל תקינה.";
    if (leadErrors.Count > 0) return Results.BadRequest(new { message = "לא ניתן לשמור את הליד. יש לתקן את השדות המסומנים.", errors = leadErrors });

    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = """
        UPDATE Leads
        SET Company=$company, ContactName=$contactName, Email=$email, Source=$source, Interest=$interest
        WHERE Id=$id;
        """;
    command.Parameters.AddWithValue("$id", id);
    command.Parameters.AddWithValue("$company", request.Company.Trim());
    command.Parameters.AddWithValue("$contactName", request.ContactName.Trim());
    command.Parameters.AddWithValue("$email", request.Email.Trim());
    command.Parameters.AddWithValue("$source", request.Source?.Trim() ?? "");
    command.Parameters.AddWithValue("$interest", request.Interest?.Trim() ?? "");

    return command.ExecuteNonQuery() == 0
        ? Results.NotFound()
        : Results.Ok(new { id, saved = true });
});

app.MapPost("/api/leads/{id:long}/convert", (long id) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "UPDATE Leads SET Status = 'הומר ללקוח' WHERE Id = $id;";
    command.Parameters.AddWithValue("$id", id);

    return command.ExecuteNonQuery() == 0
        ? Results.NotFound()
        : Results.Ok(new { id, converted = true });
});



app.MapGet("/api/customers/{id:long}", (long id, string? sort, string? direction) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT AccountNumber, CompanyId, Name, Tier, Mrr, Manager, CreditRating, Status, Tenure FROM Customers WHERE Id=$id;";
    command.Parameters.AddWithValue("$id", id);
    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();
    var customer = new { accountNumber=reader.GetString(0), companyId=reader.GetString(1), name=reader.GetString(2), tier=reader.GetString(3), mrr=reader.GetString(4), manager=reader.GetString(5), creditRating=reader.GetString(6), status=reader.GetString(7), tenure=reader.GetString(8) };
    reader.Close();
    var summary = LoadCustomerSummary(connection, id, sort, direction);
    return Results.Ok(new { customer.accountNumber, customer.companyId, customer.name, customer.tier, customer.mrr, customer.manager, customer.creditRating, customer.status, customer.tenure, summary });
});

app.MapPut("/api/customers/{id:long}", (long id, UpdateCustomerRequest request) =>
{
    var errors = new Dictionary<string, string>();
    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length < 3) errors["c360-name"] = "שם התאגיד חייב להכיל לפחות 3 תווים.";
    if (string.IsNullOrWhiteSpace(request.Tier)) errors["c360-tier"] = "יש לבחור סיווג לקוח.";
    if (string.IsNullOrWhiteSpace(request.Mrr) || !System.Text.RegularExpressions.Regex.IsMatch(request.Mrr, @"\d")) errors["c360-mrr"] = "יש להזין מחזור חודשי הכולל ערך מספרי.";
    if (string.IsNullOrWhiteSpace(request.Manager) || request.Manager.Trim().Length < 2) errors["c360-manager"] = "יש להזין מנהל תיק לקוח.";
    if (errors.Count > 0) return Results.BadRequest(new { message = "לא ניתן לשמור את תיק הלקוח. יש לתקן את השדות המסומנים.", errors });

    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "UPDATE Customers SET Name=$name, Tier=$tier, Mrr=$mrr, Manager=$manager WHERE Id=$id;";
    command.Parameters.AddWithValue("$id", id);
    command.Parameters.AddWithValue("$name", request.Name.Trim());
    command.Parameters.AddWithValue("$tier", request.Tier.Trim());
    command.Parameters.AddWithValue("$mrr", request.Mrr.Trim());
    command.Parameters.AddWithValue("$manager", request.Manager.Trim());
    return command.ExecuteNonQuery() == 0 ? Results.NotFound() : Results.Ok(new { id, saved=true });
});

app.MapPost("/customer360/field-change", async (HttpRequest request) =>
{
    var form = await request.ReadFormAsync();
    var state = new Customer360FormState(form["name"].ToString(), form["tier"].ToString(), form["mrr"].ToString(), form["manager"].ToString());
    var token = Guid.NewGuid().ToString("N");
    Customer360FormStates[token] = state;
    return Results.Redirect($"/customer360.html?state={Uri.EscapeDataString(token)}");
});

app.MapGet("/api/customer360-state/{token}", (string token) =>
{
    if (!Customer360FormStates.TryGetValue(token, out var state)) return Results.NotFound();
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT AccountNumber, CompanyId, CreditRating, Status, Tenure FROM Customers WHERE Id=10082;";
    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();
    var accountNumber=reader.GetString(0); var companyId=reader.GetString(1); var creditRating=reader.GetString(2); var status=reader.GetString(3); var tenure=reader.GetString(4);
    reader.Close();
    var summary=LoadCustomerSummary(connection, 10082);
    return Results.Ok(new { accountNumber, companyId, name=state.Name, tier=state.Tier, mrr=state.Mrr, manager=state.Manager, creditRating, status, tenure, summary });
});

app.MapPost("/case/field-change", async (HttpRequest request) =>
{
    var form = await request.ReadFormAsync();
    var state = new CaseFormState(
        form["customer"].ToString(), form["site"].ToString(), form["category"].ToString(),
        form["assigned"].ToString(), form["subject"].ToString(), form["notes"].ToString());
    var token = Guid.NewGuid().ToString("N");
    CaseFormStates[token] = state;
    return Results.Redirect($"/case.html?state={Uri.EscapeDataString(token)}");
});

app.MapGet("/api/case-state/{token}", (string token) =>
{
    if (!CaseFormStates.TryGetValue(token, out var state)) return Results.NotFound();
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT CaseNumber, Sla, Status, Priority FROM Cases WHERE Id=55891;";
    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();
    var caseNumber = reader.GetString(0); var sla = reader.GetString(1); var status = reader.GetString(2); var priority = reader.GetString(3);
    reader.Close();
    using var hc = connection.CreateCommand();
    hc.CommandText = "SELECT OccurredAt, Actor, ActionType, Description FROM CaseHistory WHERE CaseId=55891 ORDER BY Id;";
    using var hr = hc.ExecuteReader(); var history = new List<object>();
    while (hr.Read()) history.Add(new { occurredAt=hr.GetString(0), actor=hr.GetString(1), actionType=hr.GetString(2), description=hr.GetString(3) });
    return Results.Ok(new { caseNumber, customer = state.Customer, site = state.Site, category = state.Category, assigned = state.Assigned, sla, subject = state.Subject, notes = state.Notes, status, priority, history });
});

app.MapPost("/lead/field-change", async (HttpRequest request) =>
{
    var form = await request.ReadFormAsync();
    var state = new LeadFormState(
        form["company"].ToString(), form["contactName"].ToString(), form["email"].ToString(),
        form["source"].ToString(), form["interest"].ToString());
    var token = Guid.NewGuid().ToString("N");
    LeadFormStates[token] = state;
    return Results.Redirect($"/leads.html?state={Uri.EscapeDataString(token)}");
});

app.MapGet("/api/lead-state/{token}", (string token) =>
{
    if (!LeadFormStates.TryGetValue(token, out var state)) return Results.NotFound();
    using var connection = new SqliteConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT LeadNumber, Status, Potential FROM Leads WHERE Id=3094;";
    using var reader = command.ExecuteReader();
    if (!reader.Read()) return Results.NotFound();
    var leadNumber=reader.GetString(0); var status=reader.GetString(1); var potential=reader.GetString(2);
    reader.Close();
    using var pc=connection.CreateCommand();
    pc.CommandText="SELECT LeadNumber, Company, ContactName, SourceLabel, Stage, CreatedAt, StatusClass FROM LeadPipeline ORDER BY Id;";
    using var pr=pc.ExecuteReader(); var pipeline=new List<object>();
    while(pr.Read()) pipeline.Add(new { leadNumber=pr.GetString(0), company=pr.GetString(1), contactName=pr.GetString(2), sourceLabel=pr.GetString(3), stage=pr.GetString(4), createdAt=pr.GetString(5), statusClass=pr.GetString(6) });
    return Results.Ok(new { leadNumber, company = state.Company, contactName = state.ContactName, email = state.Email, source = state.Source, interest = state.Interest, status, potential, pipeline });
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
    var siteErrors = new Dictionary<string, string>();
    if (string.IsNullOrWhiteSpace(request.Code) || !request.Code.Trim().StartsWith("TLV-", StringComparison.OrdinalIgnoreCase)) siteErrors["site-code"] = "קוד האתר חייב להתחיל ב־TLV-.";
    if (string.IsNullOrWhiteSpace(request.Name)) siteErrors["site-name"] = "יש להזין שם אתר.";
    var phone = request.Phone?.Trim() ?? "";
    if (string.IsNullOrWhiteSpace(phone) || !System.Text.RegularExpressions.Regex.IsMatch(phone, @"^0\d{1,2}-?\d{7}$")) siteErrors["site-phone"] = "יש להזין מספר טלפון ישראלי תקין.";
    if (siteErrors.Count > 0) return Results.BadRequest(new { message = "לא ניתן לשמור את האתר. יש לתקן את השדות המסומנים.", errors = siteErrors });

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

static List<object> LoadCustomerSummary(SqliteConnection connection, long customerId, string? sort = null, string? direction = null)
{
    var sortColumn = sort switch
    {
        "referenceNumber" => "ReferenceNumber",
        "type" => "Type",
        "service" => "Service",
        "status" => "Status",
        "date" => "Date",
        _ => "Id"
    };
    var sortDirection = string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";

    using var command = connection.CreateCommand();
    command.CommandText = $"SELECT ReferenceNumber, Type, Service, Status, Date, StatusClass FROM CustomerSummary WHERE CustomerId=$id ORDER BY {sortColumn} {sortDirection}, Id ASC;";
    command.Parameters.AddWithValue("$id", customerId);
    using var reader = command.ExecuteReader();
    var items = new List<object>();
    while (reader.Read()) items.Add(new { referenceNumber=reader.GetString(0), type=reader.GetString(1), service=reader.GetString(2), status=reader.GetString(3), date=reader.GetString(4), statusClass=reader.GetString(5) });
    return items;
}

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

        CREATE TABLE IF NOT EXISTS Cases (
            Id INTEGER PRIMARY KEY, CaseNumber TEXT NOT NULL, Customer TEXT NOT NULL, Site TEXT NOT NULL,
            Category TEXT NOT NULL, Assigned TEXT NOT NULL, Sla TEXT NOT NULL, Subject TEXT NOT NULL,
            Notes TEXT NOT NULL, Status TEXT NOT NULL, Priority TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS CaseHistory (
            Id INTEGER PRIMARY KEY AUTOINCREMENT, CaseId INTEGER NOT NULL, OccurredAt TEXT NOT NULL,
            Actor TEXT NOT NULL, ActionType TEXT NOT NULL, Description TEXT NOT NULL,
            FOREIGN KEY (CaseId) REFERENCES Cases(Id) ON DELETE CASCADE
        );


        CREATE TABLE IF NOT EXISTS Leads (
            Id INTEGER PRIMARY KEY,
            LeadNumber TEXT NOT NULL,
            Company TEXT NOT NULL,
            ContactName TEXT NOT NULL,
            Email TEXT NOT NULL,
            Source TEXT NOT NULL,
            Interest TEXT NOT NULL,
            Status TEXT NOT NULL,
            Potential TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS LeadPipeline (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            LeadNumber TEXT NOT NULL,
            Company TEXT NOT NULL,
            ContactName TEXT NOT NULL,
            SourceLabel TEXT NOT NULL,
            Stage TEXT NOT NULL,
            CreatedAt TEXT NOT NULL,
            StatusClass TEXT NOT NULL
        );

        INSERT OR IGNORE INTO Leads
            (Id, LeadNumber, Company, ContactName, Email, Source, Interest, Status, Potential)
        VALUES
            (3094, 'LD-3094', 'נקסט-ג''ן פתרונות ענן', 'רונית שחם', 'ronit@nextgen.co.il',
             'web', 'cloud_crm', 'ליד חם (Hot Lead)', '₪45,000');

        INSERT INTO LeadPipeline (LeadNumber, Company, ContactName, SourceLabel, Stage, CreatedAt, StatusClass)
        SELECT 'LD-3094', 'נקסט-ג''ן פתרונות ענן', 'רונית שחם', 'קמפיין דיגיטל', 'בדיקת היתכנות', '10/09/2026', 'ps-status-active'
        WHERE NOT EXISTS (SELECT 1 FROM LeadPipeline WHERE LeadNumber='LD-3094');

        INSERT INTO LeadPipeline (LeadNumber, Company, ContactName, SourceLabel, Stage, CreatedAt, StatusClass)
        SELECT 'LD-3091', 'בנקאות דיגיטלית ישירה', 'עוז לוי', 'כנס פינטק', 'משא ומתן', '08/09/2026', 'ps-status-pending'
        WHERE NOT EXISTS (SELECT 1 FROM LeadPipeline WHERE LeadNumber='LD-3091');

        INSERT INTO LeadPipeline (LeadNumber, Company, ContactName, SourceLabel, Stage, CreatedAt, StatusClass)
        SELECT 'LD-3085', 'לוגיסטיקה מהירה ארצית', 'מיכל בראל', 'המלצה', 'הצעה נשלחה', '01/09/2026', 'ps-status-closed'
        WHERE NOT EXISTS (SELECT 1 FROM LeadPipeline WHERE LeadNumber='LD-3085');


        CREATE TABLE IF NOT EXISTS Customers (
            Id INTEGER PRIMARY KEY, AccountNumber TEXT NOT NULL, CompanyId TEXT NOT NULL, Name TEXT NOT NULL,
            Tier TEXT NOT NULL, Mrr TEXT NOT NULL, Manager TEXT NOT NULL, CreditRating TEXT NOT NULL,
            Status TEXT NOT NULL, Tenure TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS CustomerSummary (
            Id INTEGER PRIMARY KEY AUTOINCREMENT, CustomerId INTEGER NOT NULL, ReferenceNumber TEXT NOT NULL,
            Type TEXT NOT NULL, Service TEXT NOT NULL, Status TEXT NOT NULL, Date TEXT NOT NULL, StatusClass TEXT NOT NULL,
            FOREIGN KEY (CustomerId) REFERENCES Customers(Id) ON DELETE CASCADE
        );

        INSERT OR IGNORE INTO Customers (Id, AccountNumber, CompanyId, Name, Tier, Mrr, Manager, CreditRating, Status, Tenure)
        VALUES (10082, 'ACC-10082', '514892019', 'אלפא טכנולוגיות בע''מ', 'platinum', '₪38,500 לחודש', 'אורן שגיא', 'AAA (ללא חריגות)', 'לקוח VIP אסטרטגי', 'ותק: 4 שנים (משנת 2022)');

        INSERT INTO CustomerSummary (CustomerId, ReferenceNumber, Type, Service, Status, Date, StatusClass)
        SELECT 10082, 'CAS-55891', 'פניית שירות', 'מגדל שלום - תל אביב', 'בטיפול מומחה', '12/09/2026', 'ps-status-pending'
        WHERE NOT EXISTS (SELECT 1 FROM CustomerSummary WHERE CustomerId=10082 AND ReferenceNumber='CAS-55891');
        INSERT INTO CustomerSummary (CustomerId, ReferenceNumber, Type, Service, Status, Date, StatusClass)
        SELECT 10082, 'CTR-88102', 'הסכם SLA פרימיום', 'כלל אתרי הארגון', 'בתוקף עד 2028', '01/01/2024', 'ps-status-active'
        WHERE NOT EXISTS (SELECT 1 FROM CustomerSummary WHERE CustomerId=10082 AND ReferenceNumber='CTR-88102');
        INSERT INTO CustomerSummary (CustomerId, ReferenceNumber, Type, Service, Status, Date, StatusClass)
        SELECT 10082, 'LD-3094', 'הזדמנות הרחבה', 'אינטגרציית ענן היברידי', 'בדיקת היתכנות', '10/09/2026', 'ps-status-active'
        WHERE NOT EXISTS (SELECT 1 FROM CustomerSummary WHERE CustomerId=10082 AND ReferenceNumber='LD-3094');

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

        INSERT OR IGNORE INTO Cases (Id, CaseNumber, Customer, Site, Category, Assigned, Sla, Subject, Notes, Status, Priority)
        VALUES (55891, 'CAS-55891', 'אלפא טכנולוגיות בע''מ', 'מגדל שלום - תל אביב', 'network', 'דניאל כהן',
                'תוך 4 שעות (נותרו שעתיים)', 'איטיות בגלישה ונפילות קו תקשורת ראשי',
                'הלקוח מדווח על ניתוקים חוזרים ונשנים בקו העסקי מאז שעות הבוקר. בוצע ריסטרט מרחוק למודם ללא שיפור. נדרש תיאום טכנאי שטח.', 'בטיפול מומחה', 'גבוהה (High)');

        INSERT INTO CaseHistory (CaseId, OccurredAt, Actor, ActionType, Description)
        SELECT 55891, '12/09/2026 09:30', 'מוקדנית (שירן)', 'פתיחת פניה', 'הקריאה נוצרה עקב פנייה טלפונית מאיש הקשר באתר'
        WHERE NOT EXISTS (SELECT 1 FROM CaseHistory WHERE CaseId=55891 AND OccurredAt='12/09/2026 09:30');

        INSERT INTO CaseHistory (CaseId, OccurredAt, Actor, ActionType, Description)
        SELECT 55891, '12/09/2026 10:15', 'דניאל כהן', 'בדיקה טכנית', 'נבדק אות בקו מול ספק התשתית - זוהו איבוד חבילות (Packet Loss)'
        WHERE NOT EXISTS (SELECT 1 FROM CaseHistory WHERE CaseId=55891 AND OccurredAt='12/09/2026 10:15');

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


sealed record UpdateCaseRequest(
    string Customer,
    string? Site,
    string? Category,
    string? Assigned,
    string Subject,
    string? Notes);


sealed record UpdateLeadRequest(
    string Company,
    string ContactName,
    string Email,
    string? Source,
    string? Interest);


sealed record CaseFormState(string Customer, string Site, string Category, string Assigned, string Subject, string Notes);
sealed record LeadFormState(string Company, string ContactName, string Email, string Source, string Interest);

sealed record UpdateCustomerRequest(string Name, string Tier, string Mrr, string Manager);
sealed record Customer360FormState(string Name, string Tier, string Mrr, string Manager);
