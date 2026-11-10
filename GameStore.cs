using System.Globalization;
using Microsoft.Data.Sqlite;

sealed class GameStore(string databasePath, string schemaPath, Seed seed, CaseFixtures fixtures)
{
    private const int CustomValueLimit = 1_000_000;
    private readonly string connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = Path.GetFullPath(databasePath),
        ForeignKeys = true,
        DefaultTimeout = 10
    }.ToString();

    public void Initialize()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(databasePath))!);
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var transaction = connection.BeginTransaction(deferred: false);
        Execute(transaction, File.ReadAllText(schemaPath));
        UpgradeOriginalDatabase(transaction);
        transaction.Commit();
    }

    private static void UpgradeOriginalDatabase(SqliteTransaction transaction)
    {
        if (!Columns(transaction, "PRAGMA table_info(Player)").Contains("ScenarioId"))
            Execute(transaction, "ALTER TABLE Player ADD COLUMN ScenarioId TEXT NOT NULL DEFAULT 'free'");
        if (!Columns(transaction, "PRAGMA table_info(Mission)").Contains("Revision"))
            Execute(transaction, """
                ALTER TABLE Mission ADD COLUMN Revision INTEGER NOT NULL DEFAULT 1 CHECK (Revision > 0);
                UPDATE Mission SET Revision = 2 WHERE Id = 'M01' AND RewardCredits = 160;
                """);

        var expeditionColumns = Columns(transaction, "PRAGMA table_info(Expedition)");
        if (!expeditionColumns.Contains("CatalogRevision"))
            Execute(transaction, """
                ALTER TABLE Expedition ADD COLUMN CatalogRevision INTEGER NOT NULL DEFAULT 1 CHECK (CatalogRevision > 0);
                UPDATE Expedition SET CatalogRevision = 2 WHERE MissionId = 'M01' AND RewardCreditsSnapshot = 160;
                """);
        if (!expeditionColumns.Contains("ReplacesExpeditionId"))
            Execute(transaction, "ALTER TABLE Expedition ADD COLUMN ReplacesExpeditionId TEXT REFERENCES Expedition(Id)");
    }

    private static string[] Columns(SqliteTransaction transaction, string tableInfo) =>
        Query(transaction, tableInfo, row => row.GetString(1));

    public GameDto NewGame(string? scenarioId)
    {
        var scenario = scenarioId is null or "free"
            ? new CaseScenario("free", "Свободная партия", new(seed.Fuel, seed.Rations), null, false)
            : fixtures.Scenarios.SingleOrDefault(item => item.Id == scenarioId)
                ?? throw Fault(400, "invalid_scenario", "Учебный сценарий не найден.");
        var revision = scenario.ApplyRevision
            ? fixtures.Revision with { Cost = scenario.CatalogCost ?? fixtures.Revision.Cost }
            : null;
        return CreateGame(scenario.Id, scenario.Stock, seed.Missions, scenario.PrepareMissionId, revision);
    }

    public GameDto NewCustomGame(CustomGameRequest request)
    {
        var stock = ReadCustomResources(request.Stock, 0, "Склад");
        var original = seed.Missions.Single(mission => mission.Id == fixtures.Revision.Id);
        var snapshot = ReadCustomTerms(original, request.Snapshot, "Снимок рейса");
        var catalog = ReadCustomTerms(fixtures.Revision, request.Catalog, "Новая карточка каталога");
        if (snapshot.Cost.Fuel > stock.Fuel || snapshot.Cost.Rations > stock.Rations)
            throw Fault(400, "snapshot_exceeds_stock", "Склад должен покрывать снимок подготовленного рейса.");

        var missions = seed.Missions.Select(mission => mission.Id == snapshot.Id ? snapshot : mission);
        return CreateGame("custom", stock, missions, snapshot.Id, catalog);
    }

    private static Quantities ReadCustomResources(ResourceInput? input, int minimum, string label)
    {
        if (input?.Fuel is not int fuel || input.Rations is not int rations ||
            fuel < minimum || fuel > CustomValueLimit || rations < minimum || rations > CustomValueLimit)
            throw Fault(400, "invalid_custom_values", $"{label}: укажите целые количества от {minimum} до {CustomValueLimit}.");
        return new(fuel, rations);
    }

    private static MissionDto ReadCustomTerms(MissionDto template, MissionTermsInput? input, string label)
    {
        var cost = ReadCustomResources(input?.Cost, 1, label);
        if (input?.RewardCredits is not int reward || reward < 0 || reward > CustomValueLimit)
            throw Fault(400, "invalid_custom_values", $"{label}: укажите целую награду от 0 до {CustomValueLimit}.");
        return template with { Cost = cost, RewardCredits = reward };
    }

    private GameDto CreateGame(string scenarioId, Quantities stock, IEnumerable<MissionDto> missions,
        string? prepareMissionId, MissionDto? revision) => Write(transaction =>
    {
        var id = Guid.NewGuid();
        Execute(transaction, "INSERT INTO Player (Id, CreatedAtUtc, ScenarioId) VALUES ($id, $at, $scenario)",
            ("$id", id), ("$at", Now()), ("$scenario", scenarioId));
        Execute(transaction, """
            INSERT INTO StockItem VALUES ($id, 'fuel', $fuel), ($id, 'rations', $rations)
            """, ("$id", id), ("$fuel", stock.Fuel), ("$rations", stock.Rations));
        foreach (var mission in missions)
        {
            Execute(transaction, """
                INSERT INTO Mission (PlayerId, Id, Title, RewardCredits, Revision)
                VALUES ($player, $mission, $title, $reward, $revision);
                INSERT INTO MissionRequirement VALUES
                    ($player, $mission, 'fuel', $fuel), ($player, $mission, 'rations', $rations);
                """, ("$player", id), ("$mission", mission.Id), ("$title", mission.Title),
                ("$reward", mission.RewardCredits), ("$revision", mission.Revision),
                ("$fuel", mission.Cost.Fuel), ("$rations", mission.Cost.Rations));
        }
        if (prepareMissionId is { } missionId)
            AddExpedition(transaction, id, FindMission(transaction, id, missionId));
        if (revision is not null)
            ApplyCatalogRevision(transaction, id, revision);
        return ReadGame(transaction, id);
    });

    public GameDto GetGame(Guid playerId) => Read(transaction =>
    {
        RequireGame(transaction, playerId);
        return ReadGame(transaction, playerId);
    });

    public MissionDto[] GetMissions(Guid playerId) => Read(transaction =>
    {
        RequireGame(transaction, playerId);
        return Query(transaction, MissionSelect + " ORDER BY m.Id",
            ReadMission, ("$player", playerId));
    });

    public ExpeditionDto GetExpedition(Guid playerId, Guid expeditionId) =>
        Read(transaction => ReadExpedition(transaction, playerId, expeditionId));

    public ExpeditionDto Prepare(Guid playerId, string? missionId)
    {
        if (string.IsNullOrWhiteSpace(missionId))
            throw Fault(400, "mission_required", "Укажите идентификатор миссии.");

        return Write(transaction =>
        {
            RequireGame(transaction, playerId);
            var mission = FindMission(transaction, playerId, missionId);
            var game = ReadGame(transaction, playerId);
            if (game.Expeditions.Any(x => x.MissionId == mission.Id && x.Status == "completed"))
                throw Fault(409, "mission_completed", "Эта миссия уже выполнена.");
            if (game.ActiveExpedition is not null)
                throw Fault(409, "active_expedition", "Сначала завершите или отмените текущую экспедицию.");
            RequireSupplies(game.Inventory.Available, mission.Cost);
            return AddExpedition(transaction, playerId, mission);
        });
    }

    public ExpeditionDto Replace(Guid playerId, Guid expeditionId, int? expectedCatalogRevision)
    {
        if (expectedCatalogRevision is null or < 1)
            throw Fault(400, "revision_required", "Укажите номер принятой редакции каталога.");

        return Write(transaction =>
        {
            var original = ReadExpedition(transaction, playerId, expeditionId);
            if (original.Status != "prepared")
                throw Fault(409, "invalid_transition", "Заменить можно только подготовленный рейс.");
            var mission = FindMission(transaction, playerId, original.MissionId);
            if (mission.Revision != expectedCatalogRevision)
                throw Fault(409, "catalog_revision_mismatch", "Каталог изменился. Проверьте текущие условия перед заменой.");
            if (mission.Revision <= original.CatalogRevision)
                throw Fault(409, "revision_unchanged", "Для подготовленного рейса пока нет новой редакции.");

            // This expedition holds the only active reservation in the party.
            RequireSupplies(ReadGame(transaction, playerId).Inventory.OnHand, mission.Cost);
            ChangeStatus(transaction, original, "cancelled");
            return AddExpedition(transaction, playerId, mission, expeditionId);
        });
    }

    public ExpeditionDto Transition(Guid playerId, Guid expeditionId, string? action)
    {
        if (action is not ("launch" or "complete" or "cancel"))
            throw Fault(400, "invalid_action", "Допустимые действия: launch, complete, cancel.");

        return Write(transaction =>
        {
            var expedition = ReadExpedition(transaction, playerId, expeditionId);
            var next = (expedition.Status, action) switch
            {
                ("prepared", "launch") => "inFlight",
                ("inFlight", "complete") => "completed",
                ("prepared", "cancel") => "cancelled",
                _ => throw Fault(409, "invalid_transition", "Это действие недоступно в текущем состоянии экспедиции.")
            };
            if (next == "inFlight")
                SpendReservedSupplies(transaction, playerId, expeditionId);

            ChangeStatus(transaction, expedition, next);
            return ReadExpedition(transaction, playerId, expeditionId);
        });
    }

    public MissionDto ReviseCatalog(Guid playerId) => Write(transaction =>
    {
        RequireGame(transaction, playerId);
        var current = FindMission(transaction, playerId, fixtures.Revision.Id);
        if (current.Revision >= fixtures.Revision.Revision) return current;
        ApplyCatalogRevision(transaction, playerId, fixtures.Revision);
        return FindMission(transaction, playerId, fixtures.Revision.Id);
    });

    private static void ApplyCatalogRevision(SqliteTransaction transaction, Guid playerId, MissionDto revision)
    {
        Execute(transaction, """
            UPDATE Mission SET Title = $title, RewardCredits = $reward, Revision = $revision WHERE PlayerId = $player AND Id = $mission;
            UPDATE MissionRequirement SET Quantity = CASE SupplyCode WHEN 'fuel' THEN $fuel ELSE $rations END
            WHERE PlayerId = $player AND MissionId = $mission;
            """, ("$player", playerId), ("$mission", revision.Id), ("$title", revision.Title),
            ("$reward", revision.RewardCredits), ("$revision", revision.Revision),
            ("$fuel", revision.Cost.Fuel), ("$rations", revision.Cost.Rations));
    }

    private static void RequireSupplies(Quantities available, Quantities cost)
    {
        var missing = new List<string>();
        if (cost.Fuel > available.Fuel)
            missing.Add($"топливо — {cost.Fuel - available.Fuel} ед.");
        if (cost.Rations > available.Rations)
            missing.Add($"пайки — {cost.Rations - available.Rations} шт.");
        if (missing.Count > 0)
            throw Fault(409, "insufficient_supplies", "Не хватает: " + string.Join(", ", missing));
    }

    private static ExpeditionDto AddExpedition(SqliteTransaction transaction, Guid playerId, MissionDto mission,
        Guid? replacesExpeditionId = null)
    {
        var id = Guid.NewGuid();
        var at = Now();
        Execute(transaction, """
            INSERT INTO Expedition (Id, PlayerId, MissionId, Status, CreatedAtUtc, RewardCreditsSnapshot, CatalogRevision, ReplacesExpeditionId)
            VALUES ($id, $player, $mission, 'prepared', $at, $reward, $revision, $replaces);
            INSERT INTO ExpeditionSupply VALUES ($id, 'fuel', $fuel), ($id, 'rations', $rations);
            """, ("$id", id), ("$player", playerId), ("$mission", mission.Id), ("$at", at),
            ("$reward", mission.RewardCredits), ("$revision", mission.Revision), ("$replaces", replacesExpeditionId),
            ("$fuel", mission.Cost.Fuel), ("$rations", mission.Cost.Rations));
        AppendEvent(transaction, id, 1, null, "prepared", at);
        return ReadExpedition(transaction, playerId, id);
    }

    private static void ChangeStatus(SqliteTransaction transaction, ExpeditionDto expedition, string status)
    {
        Execute(transaction, "UPDATE Expedition SET Status = $status WHERE Id = $id",
            ("$status", status), ("$id", expedition.Id));
        AppendEvent(transaction, expedition.Id, expedition.History.Length + 1, expedition.Status, status, Now());
    }

    private static MissionDto FindMission(SqliteTransaction transaction, Guid playerId, string missionId) =>
        Query(transaction, MissionSelect + " AND m.Id = $mission", ReadMission,
            ("$player", playerId), ("$mission", missionId)).SingleOrDefault()
            ?? throw Fault(404, "mission_not_found", "Миссия отсутствует в каталоге.");

    private static void SpendReservedSupplies(SqliteTransaction transaction, Guid playerId, Guid expeditionId) =>
        Execute(transaction, """
            UPDATE StockItem
            SET OnHand = OnHand - (
                SELECT Quantity FROM ExpeditionSupply WHERE ExpeditionId = $id AND SupplyCode = StockItem.SupplyCode
            )
            WHERE PlayerId = $player AND SupplyCode IN (SELECT SupplyCode FROM ExpeditionSupply WHERE ExpeditionId = $id)
            """, ("$player", playerId), ("$id", expeditionId));

    private static void AppendEvent(SqliteTransaction transaction, Guid id, int sequence, string? from, string to, string at) =>
        Execute(transaction, "INSERT INTO ExpeditionStatusEvent VALUES ($id, $seq, $from, $to, $at)",
            ("$id", id), ("$seq", sequence), ("$from", from), ("$to", to), ("$at", at));

    private const string MissionSelect = """
        SELECT m.Id, m.Title, m.RewardCredits, fuel.Quantity, rations.Quantity, m.Revision
        FROM Mission m
        JOIN MissionRequirement fuel ON fuel.PlayerId = m.PlayerId AND fuel.MissionId = m.Id AND fuel.SupplyCode = 'fuel'
        JOIN MissionRequirement rations ON rations.PlayerId = m.PlayerId AND rations.MissionId = m.Id AND rations.SupplyCode = 'rations'
        WHERE m.PlayerId = $player
        """;

    private static MissionDto ReadMission(SqliteDataReader row) =>
        new(row.GetString(0), row.GetString(1), row.GetInt32(2), new(row.GetInt32(3), row.GetInt32(4)), row.GetInt32(5));

    private static GameDto ReadGame(SqliteTransaction transaction, Guid playerId)
    {
        var supplies = Query(transaction, """
            SELECT s.SupplyCode, s.OnHand, COALESCE((
                SELECT SUM(es.Quantity)
                FROM ExpeditionSupply es JOIN Expedition e ON e.Id = es.ExpeditionId
                WHERE e.PlayerId = s.PlayerId AND e.Status = 'prepared' AND es.SupplyCode = s.SupplyCode
            ), 0)
            FROM StockItem s WHERE s.PlayerId = $player
            """, row => (Code: row.GetString(0), Stock: row.GetInt32(1), Reserved: row.GetInt32(2)),
            ("$player", playerId)).ToDictionary(x => x.Code);
        var fuel = supplies["fuel"];
        var rations = supplies["rations"];
        var inventory = new InventoryDto(new(fuel.Stock, rations.Stock), new(fuel.Reserved, rations.Reserved),
            new(fuel.Stock - fuel.Reserved, rations.Stock - rations.Reserved));

        var expeditions = Query(transaction, """
            SELECT Id, MissionId, Status, RewardCreditsSnapshot, CatalogRevision, ReplacesExpeditionId FROM Expedition
            WHERE PlayerId = $player ORDER BY CreatedAtUtc DESC, Id DESC
            """, row => new ExpeditionSummary(Guid.Parse(row.GetString(0)), row.GetString(1), row.GetString(2),
                row.GetInt32(3), row.GetInt32(4), row.IsDBNull(5) ? null : Guid.Parse(row.GetString(5))),
            ("$player", playerId));
        var active = expeditions.SingleOrDefault(x => x.Status is "prepared" or "inFlight");
        var credits = expeditions.Where(x => x.Status == "completed").Sum(x => x.RewardCreditsSnapshot);
        var scenarioId = Query(transaction, "SELECT ScenarioId FROM Player WHERE Id = $id",
            row => row.GetString(0), ("$id", playerId)).Single();
        return new(playerId, credits, inventory, active, expeditions, scenarioId);
    }

    private static ExpeditionDto ReadExpedition(SqliteTransaction transaction, Guid playerId, Guid id)
    {
        var result = Query(transaction, """
            SELECT e.MissionId, e.Status, e.RewardCreditsSnapshot, e.CreatedAtUtc, fuel.Quantity, rations.Quantity,
                e.CatalogRevision, e.ReplacesExpeditionId
            FROM Expedition e
            JOIN ExpeditionSupply fuel ON fuel.ExpeditionId = e.Id AND fuel.SupplyCode = 'fuel'
            JOIN ExpeditionSupply rations ON rations.ExpeditionId = e.Id AND rations.SupplyCode = 'rations'
            WHERE e.PlayerId = $player AND e.Id = $id
            """, row => new ExpeditionDto(id, row.GetString(0), row.GetString(1), row.GetInt32(2),
                new(row.GetInt32(4), row.GetInt32(5)), ParseTime(row.GetString(3)), [], row.GetInt32(6),
                row.IsDBNull(7) ? null : Guid.Parse(row.GetString(7))), ("$player", playerId), ("$id", id))
            .SingleOrDefault() ?? throw Fault(404, "expedition_not_found", "Экспедиция не найдена в этой партии.");

        var history = Query(transaction, """
            SELECT Sequence, FromStatus, ToStatus, ChangedAtUtc
            FROM ExpeditionStatusEvent WHERE ExpeditionId = $id ORDER BY Sequence
            """, row => new EventDto(row.GetInt32(0), row.IsDBNull(1) ? null : row.GetString(1), row.GetString(2),
                ParseTime(row.GetString(3))), ("$id", id));
        return result with { History = history };
    }

    private static void RequireGame(SqliteTransaction transaction, Guid playerId)
    {
        if (Query(transaction, "SELECT 1 FROM Player WHERE Id = $id", row => row.GetInt32(0), ("$id", playerId)).Length == 0)
            throw Fault(404, "game_not_found", "Партия не найдена. Начните новую партию.");
    }

    private T Read<T>(Func<SqliteTransaction, T> operation) => Run(operation, deferred: true);
    private T Write<T>(Func<SqliteTransaction, T> operation) => Run(operation, deferred: false);

    private T Run<T>(Func<SqliteTransaction, T> operation, bool deferred)
    {
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var transaction = connection.BeginTransaction(deferred);
        var result = operation(transaction);
        transaction.Commit();
        return result;
    }

    private static T[] Query<T>(SqliteTransaction transaction, string sql, Func<SqliteDataReader, T> project,
        params (string Name, object? Value)[] parameters)
    {
        using var command = Command(transaction, sql, parameters);
        using var reader = command.ExecuteReader();
        var rows = new List<T>();
        while (reader.Read())
            rows.Add(project(reader));
        return [.. rows];
    }

    private static void Execute(SqliteTransaction transaction, string sql, params (string Name, object? Value)[] parameters)
    {
        using var command = Command(transaction, sql, parameters);
        command.ExecuteNonQuery();
    }

    private static SqliteCommand Command(SqliteTransaction transaction, string sql, (string Name, object? Value)[] parameters)
    {
        var command = transaction.Connection!.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
            command.Parameters.AddWithValue(name, value switch { Guid guid => guid.ToString(), null => DBNull.Value, _ => value });
        return command;
    }

    private static string Now() => DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
    private static DateTimeOffset ParseTime(string value) => DateTimeOffset.Parse(value, CultureInfo.InvariantCulture);
    private static GameFault Fault(int status, string code, string message) => new(status, code, message);
}
