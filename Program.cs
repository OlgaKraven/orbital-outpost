using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var dataPath = Path.Combine(builder.Environment.ContentRootPath, "data");
var dbPath = builder.Configuration["GameDatabase"] ?? Path.Combine(builder.Environment.ContentRootPath, "state", "outpost.db");
var seed = JsonSerializer.Deserialize<Seed>(File.ReadAllText(Path.Combine(dataPath, "seed.json")), JsonSerializerOptions.Web)
    ?? throw new InvalidOperationException("Начальные данные не прочитаны.");
var fixtures = JsonSerializer.Deserialize<CaseFixtures>(File.ReadAllText(Path.Combine(dataPath, "scenarios.json")), JsonSerializerOptions.Web)
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
app.Use(async (context, next) =>
{
    var destination = context.Request.Path.Value?.ToLowerInvariant() switch
    {
        "/launch.html" or "/primer.html" => "simulator-learn",
        "/guide.html" or "/student-guide.html" => "simulator-build",
        "/brief.html" or "/domain.html" => "simulator-dossier",
        "/reference.html" => "simulator-reference",
        "/materials.html" => "simulator-materials",
        "/workbook.html" => "worksheet-1",
        _ => null
    };
    if (destination is not null && (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Redirect($"{context.Request.PathBase}/#{destination}");
        return;
    }
    await next(context);
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

var api = app.MapGroup("/api");
api.MapPost("/demo/games", (string? scenario, GameStore games) => TypedResults.Ok(games.NewGame(scenario)));
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
record TransitionRequest(string? Action);
record ReplacementRequest([property: JsonNumberHandling(JsonNumberHandling.Strict)] int? ExpectedCatalogRevision);
