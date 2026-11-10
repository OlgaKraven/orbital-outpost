var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var stock = new Resources(10, 5);
var agreedCost = new Resources(6, 2);
var currentCost = builder.Configuration.GetValue<bool>("LaunchTransfer") ? new Resources(8, 4) : new Resources(7, 3);
var status = "prepared";
var history = new List<string> { status };
var gate = new object();

app.MapGet("/api/game", () =>
{
    lock (gate)
        return new { status, stock, agreedCost, currentCost, history = history.ToArray() };
});

app.MapPost("/api/expeditions/E01/transitions", (LaunchRequest request) =>
{
    if (request.Action != "launch")
        return Results.BadRequest(new { error = "invalid_action" });

    lock (gate)
    {
        if (status != "prepared")
            return Results.Conflict(new { error = "invalid_transition" });

        stock = new Resources(stock.Fuel - agreedCost.Fuel, stock.Rations - agreedCost.Rations);
        status = "inFlight";
        history.Add(status);
        return Results.Ok(new { status, stock });
    }
});

app.Run();

record Resources(int Fuel, int Rations);
record LaunchRequest(string? Action);
