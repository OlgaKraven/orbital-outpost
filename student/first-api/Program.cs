var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var stock = new Resources(10, 5);
var agreedCost = new Resources(6, 2);
var currentCost = builder.Configuration.GetValue<bool>("LaunchTransfer") ? new Resources(8, 4) : new Resources(7, 3);
var status = "prepared";
var history = new List<string> { status };

app.MapGet("/api/game", () => new { status, stock, agreedCost, currentCost, history });

// Add POST /api/expeditions/E01/transitions here.
// See ../launch.html#launch for the exercise and ../launch.html#verify for the requests.

app.Run();

record Resources(int Fuel, int Rations);
record LaunchRequest(string? Action);
