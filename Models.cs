record Seed(int Fuel, int Rations, MissionDto[] Missions);
record Quantities(int Fuel, int Rations);
record MissionDto(string Id, string Title, int RewardCredits, Quantities Cost, int Revision = 1);
record CaseScenario(string Id, string Title, Quantities Stock, string? PrepareMissionId, bool ApplyRevision, Quantities? CatalogCost = null);
record CaseFixtures(MissionDto Revision, CaseScenario[] Scenarios);
record InventoryDto(Quantities OnHand, Quantities Reserved, Quantities Available);
record EventDto(int Sequence, string? FromStatus, string ToStatus, DateTimeOffset ChangedAtUtc);
record ExpeditionDto(Guid Id, string MissionId, string Status, int RewardCreditsSnapshot, Quantities Cost,
    DateTimeOffset CreatedAtUtc, EventDto[] History, int CatalogRevision, Guid? ReplacesExpeditionId);
record ExpeditionSummary(Guid Id, string MissionId, string Status, int RewardCreditsSnapshot,
    int CatalogRevision, Guid? ReplacesExpeditionId);
record GameDto(Guid Id, int Credits, InventoryDto Inventory, ExpeditionSummary? ActiveExpedition,
    ExpeditionSummary[] Expeditions, string ScenarioId);
sealed class GameFault(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
