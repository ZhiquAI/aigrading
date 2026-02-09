-- CreateTable
CREATE TABLE "RubricTemplate" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'user',
    "activationCode" TEXT,
    "subject" TEXT,
    "grade" TEXT,
    "questionType" TEXT,
    "strategyType" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '3.0',
    "metadata" JSONB,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RubricTemplate_scope_idx" ON "RubricTemplate"("scope");
CREATE INDEX "RubricTemplate_activationCode_idx" ON "RubricTemplate"("activationCode");
CREATE INDEX "RubricTemplate_subject_idx" ON "RubricTemplate"("subject");
CREATE INDEX "RubricTemplate_grade_idx" ON "RubricTemplate"("grade");
CREATE INDEX "RubricTemplate_questionType_idx" ON "RubricTemplate"("questionType");
CREATE INDEX "RubricTemplate_strategyType_idx" ON "RubricTemplate"("strategyType");
