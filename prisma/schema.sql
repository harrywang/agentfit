-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filesProcessed" INTEGER NOT NULL,
    "sessionsAdded" INTEGER NOT NULL,
    "sessionsSkipped" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentJson" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionId_key" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_project_idx" ON "Session"("project");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_startTime_idx" ON "Session"("startTime");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Image_sessionId_idx" ON "Image"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Image_sessionId_messageId_filename_key" ON "Image"("sessionId", "messageId", "filename");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_generatedAt_idx" ON "Report"("generatedAt");

