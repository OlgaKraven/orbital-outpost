using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var dataPath = Path.Combine(builder.Environment.ContentRootPath, "data");
var dbPath = builder.Configuration["GameDatabase"] ?? Path.Combine(builder.Environment.ContentRootPath, "state", "outpost.db");
var seedSource = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(Path.Combine(dataPath, "seed.json")));
var scenarioSource = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(Path.Combine(dataPath, "scenarios.json")));
var seed = seedSource.Deserialize<Seed>(JsonSerializerOptions.Web)
    ?? throw new InvalidOperationException("Начальные данные не прочитаны.");
var fixtures = scenarioSource.Deserialize<CaseFixtures>(JsonSerializerOptions.Web)
    ?? throw new InvalidOperationException("Сценарии не прочитаны.");

var store = new GameStore(dbPath, Path.Combine(dataPath, "schema.sql"), seed, fixtures);
store.Initialize();
builder.Services.AddSingleton(store);
builder.Services.AddProblemDetails();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (GameFault fault) when (!context.Response.HasStarted)
    {
        await TypedResults.Problem(statusCode: fault.Status, title: fault.Message,
            extensions: new Dictionary<string, object?> { ["code"] = fault.Code }).ExecuteAsync(context);
    }
});
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        if (Path.GetExtension(context.File.Name) is ".html" or ".js" or ".css")
            context.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.MapGet("/study/fixtures", () => TypedResults.Ok(new { seed = seedSource, scenarios = scenarioSource }));

var api = app.MapGroup("/api");
api.MapPost("/demo/games", (string? scenario, GameStore games) => TypedResults.Ok(games.NewGame(scenario)));
api.MapPost("/demo/games/custom", (CustomGameRequest request, GameStore games) => TypedResults.Ok(games.NewCustomGame(request)));
api.MapPost("/demo/catalog-revision", ([FromHeader(Name = "X-Game-Id")] Guid gameId, GameStore games) =>
    TypedResults.Ok(games.ReviseCatalog(gameId)));
api.MapGet("/missions", ([FromHeader(Name = "X-Game-Id")] Guid gameId, GameStore games) =>
    TypedResults.Ok(games.GetMissions(gameId)));
api.MapGet("/game", ([FromHeader(Name = "X-Game-Id")] Guid gameId, GameStore games) =>
    TypedResults.Ok(games.GetGame(gameId)));
api.MapPost("/expeditions", ([FromHeader(Name = "X-Game-Id")] Guid gameId, PrepareRequest request, GameStore games) =>
{
    var expedition = games.Prepare(gameId, request.MissionId);
    return TypedResults.Created($"/api/expeditions/{expedition.Id}", expedition);
});
api.MapGet("/expeditions/{id:guid}", ([FromHeader(Name = "X-Game-Id")] Guid gameId, Guid id, GameStore games) =>
    TypedResults.Ok(games.GetExpedition(gameId, id)));
api.MapPost("/expeditions/{id:guid}/transitions", ([FromHeader(Name = "X-Game-Id")] Guid gameId, Guid id,
    TransitionRequest request, GameStore games) => TypedResults.Ok(games.Transition(gameId, id, request.Action)));
api.MapPost("/expeditions/{id:guid}/replacements", ([FromHeader(Name = "X-Game-Id")] Guid gameId, Guid id,
    ReplacementRequest request, GameStore games) =>
{
    var expedition = games.Replace(gameId, id, request.ExpectedCatalogRevision);
    return TypedResults.Created($"/api/expeditions/{expedition.Id}", expedition);
});

app.Run();

record PrepareRequest(string? MissionId);
record CustomGameRequest(ResourceInput? Stock, MissionTermsInput? Snapshot, MissionTermsInput? Catalog);
record ResourceInput([property: JsonNumberHandling(JsonNumberHandling.Strict)] int? Fuel,
    [property: JsonNumberHandling(JsonNumberHandling.Strict)] int? Rations);
record MissionTermsInput(ResourceInput? Cost, [property: JsonNumberHandling(JsonNumberHandling.Strict)] int? RewardCredits);
record TransitionRequest(string? Action);
record ReplacementRequest([property: JsonNumberHandling(JsonNumberHandling.Strict)] int? ExpectedCatalogRevision);
