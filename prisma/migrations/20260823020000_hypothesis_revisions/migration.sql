-- Belief change becomes a first-class record rather than an overwritten field.
CREATE TABLE "HypothesisRevision" (
    "id" TEXT NOT NULL,
    "hypothesisId" TEXT NOT NULL,
    "before" DOUBLE PRECISION NOT NULL,
    "after" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "observationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypothesisRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HypothesisRevision_hypothesisId_createdAt_idx"
    ON "HypothesisRevision"("hypothesisId", "createdAt");

ALTER TABLE "HypothesisRevision" ADD CONSTRAINT "HypothesisRevision_hypothesisId_fkey"
    FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
