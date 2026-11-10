CREATE TABLE IF NOT EXISTS Player (
    Id TEXT PRIMARY KEY,
    CreatedAtUtc TEXT NOT NULL,
    ScenarioId TEXT NOT NULL DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS SupplyType (
    Code TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Unit TEXT NOT NULL
);

INSERT OR IGNORE INTO SupplyType VALUES ('fuel', 'Топливо', 'ед.'), ('rations', 'Пайки', 'шт.');

CREATE TABLE IF NOT EXISTS StockItem (
    PlayerId TEXT NOT NULL REFERENCES Player(Id),
    SupplyCode TEXT NOT NULL REFERENCES SupplyType(Code),
    OnHand INTEGER NOT NULL CHECK (OnHand >= 0),
    PRIMARY KEY (PlayerId, SupplyCode)
);

CREATE TABLE IF NOT EXISTS Mission (
    PlayerId TEXT NOT NULL REFERENCES Player(Id),
    Id TEXT NOT NULL,
    Title TEXT NOT NULL,
    RewardCredits INTEGER NOT NULL CHECK (RewardCredits >= 0),
    Revision INTEGER NOT NULL DEFAULT 1 CHECK (Revision > 0),
    PRIMARY KEY (PlayerId, Id)
);

CREATE TABLE IF NOT EXISTS MissionRequirement (
    PlayerId TEXT NOT NULL,
    MissionId TEXT NOT NULL,
    SupplyCode TEXT NOT NULL REFERENCES SupplyType(Code),
    Quantity INTEGER NOT NULL CHECK (Quantity > 0),
    PRIMARY KEY (PlayerId, MissionId, SupplyCode),
    FOREIGN KEY (PlayerId, MissionId) REFERENCES Mission(PlayerId, Id)
);

CREATE TABLE IF NOT EXISTS Expedition (
    Id TEXT PRIMARY KEY,
    PlayerId TEXT NOT NULL,
    MissionId TEXT NOT NULL,
    Status TEXT NOT NULL CHECK (Status IN ('prepared', 'inFlight', 'completed', 'cancelled')),
    CreatedAtUtc TEXT NOT NULL,
    RewardCreditsSnapshot INTEGER NOT NULL CHECK (RewardCreditsSnapshot >= 0),
    CatalogRevision INTEGER NOT NULL DEFAULT 1 CHECK (CatalogRevision > 0),
    ReplacesExpeditionId TEXT REFERENCES Expedition(Id),
    FOREIGN KEY (PlayerId, MissionId) REFERENCES Mission(PlayerId, Id)
);

CREATE UNIQUE INDEX IF NOT EXISTS OneActiveExpedition
    ON Expedition (PlayerId) WHERE Status IN ('prepared', 'inFlight');

CREATE UNIQUE INDEX IF NOT EXISTS OneCompletedMission
    ON Expedition (PlayerId, MissionId) WHERE Status = 'completed';

CREATE TABLE IF NOT EXISTS ExpeditionSupply (
    ExpeditionId TEXT NOT NULL REFERENCES Expedition(Id),
    SupplyCode TEXT NOT NULL REFERENCES SupplyType(Code),
    Quantity INTEGER NOT NULL CHECK (Quantity > 0),
    PRIMARY KEY (ExpeditionId, SupplyCode)
);

CREATE TABLE IF NOT EXISTS ExpeditionStatusEvent (
    ExpeditionId TEXT NOT NULL REFERENCES Expedition(Id),
    Sequence INTEGER NOT NULL CHECK (Sequence > 0),
    FromStatus TEXT,
    ToStatus TEXT NOT NULL,
    ChangedAtUtc TEXT NOT NULL,
    PRIMARY KEY (ExpeditionId, Sequence)
);
