-- RubricTemplate: support lifecycle workflow + source rubric linkage
ALTER TABLE "RubricTemplate"
  ADD COLUMN IF NOT EXISTS "questionKey" TEXT,
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS "RubricTemplate_questionKey_idx" ON "RubricTemplate"("questionKey");
CREATE INDEX IF NOT EXISTS "RubricTemplate_lifecycleStatus_idx" ON "RubricTemplate"("lifecycleStatus");
