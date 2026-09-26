PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT NOT NULL UNIQUE,
    DisplayName TEXT,
    PasswordHash TEXT NOT NULL,
    IsActive INTEGER NOT NULL DEFAULT 1 CHECK (IsActive IN (0, 1))
);

CREATE TABLE IF NOT EXISTS UserRoles (
    UserId INTEGER NOT NULL,
    Role TEXT NOT NULL CHECK (Role IN ('admin', 'editor', 'learner')),
    PRIMARY KEY (UserId, Role),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Topics (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Guides (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TopicId INTEGER NOT NULL,
    Name TEXT NOT NULL,
    StartInstruction TEXT NOT NULL,
    IsAvailable INTEGER NOT NULL DEFAULT 0 CHECK (IsAvailable IN (0, 1)),
    FOREIGN KEY (TopicId) REFERENCES Topics(Id)
);

CREATE TABLE IF NOT EXISTS GuideSteps (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    GuideId INTEGER NOT NULL,
    StepOrder INTEGER NOT NULL CHECK (StepOrder > 0),
    Selector TEXT NOT NULL,
    Instruction TEXT NOT NULL,
    ScreenName TEXT,
    FrameTarget TEXT,
    ValidationEngine TEXT,
    ValidationExpression TEXT,
    ValidationErrorMessage TEXT,
    ValidationBuilderType TEXT,
    ValidationBuilderValue TEXT,
    FOREIGN KEY (GuideId) REFERENCES Guides(Id) ON DELETE CASCADE,
    UNIQUE (GuideId, StepOrder)
);

CREATE TABLE IF NOT EXISTS StepValidations (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    StepId INTEGER NOT NULL,
    ValidationType TEXT NOT NULL,
    ExpectedValue TEXT,
    ErrorMessage TEXT,
    FOREIGN KEY (StepId) REFERENCES GuideSteps(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UserProgress (
    UserId INTEGER NOT NULL,
    GuideId INTEGER NOT NULL,
    CurrentStepId INTEGER,
    CurrentStepOrder INTEGER NOT NULL DEFAULT 1 CHECK (CurrentStepOrder > 0),
    Status TEXT NOT NULL DEFAULT 'InProgress' CHECK (Status IN ('Started', 'InProgress', 'Completed')),
    IsCompleted INTEGER NOT NULL DEFAULT 0 CHECK (IsCompleted IN (0, 1)),
    StartedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastActivityAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CompletedAt TEXT,
    PRIMARY KEY (UserId, GuideId),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (GuideId) REFERENCES Guides(Id) ON DELETE CASCADE,
    FOREIGN KEY (CurrentStepId) REFERENCES GuideSteps(Id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS UserStepProgress (
    UserId INTEGER NOT NULL,
    GuideId INTEGER NOT NULL,
    GuideStepId INTEGER NOT NULL,
    CompletedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (UserId, GuideStepId),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (GuideId) REFERENCES Guides(Id) ON DELETE CASCADE,
    FOREIGN KEY (GuideStepId) REFERENCES GuideSteps(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_UserRoles_Role
    ON UserRoles(Role);

CREATE INDEX IF NOT EXISTS IX_Guides_TopicId
    ON Guides(TopicId);

CREATE INDEX IF NOT EXISTS IX_GuideSteps_GuideId
    ON GuideSteps(GuideId);

CREATE INDEX IF NOT EXISTS IX_StepValidations_StepId
    ON StepValidations(StepId);

CREATE INDEX IF NOT EXISTS IX_UserProgress_GuideId
    ON UserProgress(GuideId);

CREATE INDEX IF NOT EXISTS IX_UserStepProgress_UserGuide
    ON UserStepProgress(UserId, GuideId);
