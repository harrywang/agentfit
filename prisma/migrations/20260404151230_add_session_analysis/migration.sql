-- CreateTable
CREATE TABLE "SessionAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "classifications" TEXT NOT NULL,
    "totalMessages" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUSD" REAL NOT NULL,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionAnalysis_sessionId_key" ON "SessionAnalysis"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAnalysis_sessionId_idx" ON "SessionAnalysis"("sessionId");
