using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();

var data = Path.Combine(builder.Environment.ContentRootPath, "data");
var seed = ReadJson(Path.Combine(data, "seed.json"));
var scenarios = ReadJson(Path.Combine(data, "scenarios.json"));

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapGet("/healthz", () => TypedResults.Ok(new { status = "ok" }));
app.MapGet("/study/fixtures", () => TypedResults.Ok(new { seed, scenarios }));

// Add MapGroup("/api") when your catalog and party storage are ready.
// Use schema.sql and the result of stations 4–6 to build the first SQLite read model.
app.Run();

static JsonElement ReadJson(string path)
{
    using var document = JsonDocument.Parse(File.ReadAllText(path));
    return document.RootElement.Clone();
}
