-- CreateTable User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable Config
CREATE TABLE IF NOT EXISTS "Config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable GradingRecord
CREATE TABLE IF NOT EXISTS "GradingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionNo" TEXT,
    "studentName" TEXT NOT NULL,
    "examNo" TEXT,
    "score" REAL NOT NULL,
    "maxScore" REAL NOT NULL,
    "comment" TEXT,
    "breakdown" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable ActivationCode
CREATE TABLE IF NOT EXISTS "ActivationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "usedBy" TEXT,
    "usedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT
);

-- CreateTable UsageRecord
CREATE TABLE IF NOT EXISTS "UsageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Config_userId_idx" ON "Config"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Config_userId_key_key" ON "Config"("userId", "key");
CREATE INDEX IF NOT EXISTS "GradingRecord_userId_idx" ON "GradingRecord"("userId");
CREATE INDEX IF NOT EXISTS "GradingRecord_questionNo_idx" ON "GradingRecord"("questionNo");
CREATE UNIQUE INDEX IF NOT EXISTS "ActivationCode_code_key" ON "ActivationCode"("code");
CREATE INDEX IF NOT EXISTS "ActivationCode_code_idx" ON "ActivationCode"("code");
CREATE INDEX IF NOT EXISTS "ActivationCode_batchId_idx" ON "ActivationCode"("batchId");
CREATE INDEX IF NOT EXISTS "UsageRecord_deviceId_idx" ON "UsageRecord"("deviceId");
CREATE INDEX IF NOT EXISTS "UsageRecord_createdAt_idx" ON "UsageRecord"("createdAt");
