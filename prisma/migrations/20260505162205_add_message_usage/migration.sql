-- CreateTable
CREATE TABLE "MessageUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "speed" TEXT NOT NULL DEFAULT 'standard',
    "timestamp" DATETIME NOT NULL,
    "date" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheCreationTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "costUSD" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MessageUsage_date_idx" ON "MessageUsage"("date");

-- CreateIndex
CREATE INDEX "MessageUsage_sessionId_idx" ON "MessageUsage"("sessionId");

-- CreateIndex
CREATE INDEX "MessageUsage_model_idx" ON "MessageUsage"("model");

-- CreateIndex
CREATE UNIQUE INDEX "MessageUsage_messageId_requestId_key" ON "MessageUsage"("messageId", "requestId");
