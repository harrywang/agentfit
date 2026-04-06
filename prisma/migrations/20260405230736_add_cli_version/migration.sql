-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "durationMinutes" REAL NOT NULL,
    "userMessages" INTEGER NOT NULL,
    "assistantMessages" INTEGER NOT NULL,
    "totalMessages" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheCreationTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUSD" REAL NOT NULL,
    "model" TEXT NOT NULL,
    "toolCallsTotal" INTEGER NOT NULL,
    "toolCallsJson" TEXT NOT NULL,
    "skillCallsJson" TEXT NOT NULL DEFAULT '{}',
    "messageTimestamps" TEXT NOT NULL DEFAULT '[]',
    "apiErrors" INTEGER NOT NULL DEFAULT 0,
    "rateLimitErrors" INTEGER NOT NULL DEFAULT 0,
    "userInterruptions" INTEGER NOT NULL DEFAULT 0,
    "permissionModesJson" TEXT NOT NULL DEFAULT '{}',
    "systemPromptEdits" INTEGER NOT NULL DEFAULT 0,
    "cliVersion" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Session" ("apiErrors", "assistantMessages", "cacheCreationTokens", "cacheReadTokens", "costUSD", "createdAt", "durationMinutes", "endTime", "id", "inputTokens", "messageTimestamps", "model", "outputTokens", "permissionModesJson", "project", "projectPath", "rateLimitErrors", "sessionId", "skillCallsJson", "startTime", "systemPromptEdits", "toolCallsJson", "toolCallsTotal", "totalMessages", "totalTokens", "userInterruptions", "userMessages") SELECT "apiErrors", "assistantMessages", "cacheCreationTokens", "cacheReadTokens", "costUSD", "createdAt", "durationMinutes", "endTime", "id", "inputTokens", "messageTimestamps", "model", "outputTokens", "permissionModesJson", "project", "projectPath", "rateLimitErrors", "sessionId", "skillCallsJson", "startTime", "systemPromptEdits", "toolCallsJson", "toolCallsTotal", "totalMessages", "totalTokens", "userInterruptions", "userMessages" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_sessionId_key" ON "Session"("sessionId");
CREATE INDEX "Session_project_idx" ON "Session"("project");
CREATE INDEX "Session_startTime_idx" ON "Session"("startTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
