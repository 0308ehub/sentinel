-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('MATH', 'READING', 'REASONING');

-- CreateEnum
CREATE TYPE "MemoryNodeType" AS ENUM ('INTEREST', 'CONCEPT', 'SKILL', 'MISCONCEPTION', 'REASONING_PATTERN', 'TEACHING_STRATEGY', 'EXPERIENCE', 'GOAL', 'CONVERSATION_MEMORY', 'PERSON', 'BOOK', 'STORY');

-- CreateEnum
CREATE TYPE "MemoryRelationship" AS ENUM ('STRUGGLES_WITH', 'MASTERED', 'INTERESTED_IN', 'RESPONDS_WELL_TO', 'CONFUSES_WITH', 'PREREQUISITE_OF', 'EXPLAINED_BY', 'IMPROVED_BY', 'AVOIDS', 'PREFERS', 'RETAINED_AFTER', 'CAUSED_BY');

-- CreateEnum
CREATE TYPE "HypothesisStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'REFUTED', 'DORMANT');

-- CreateEnum
CREATE TYPE "TutorAction" AS ENUM ('PROBE', 'EXPLAIN', 'GIVE_EXAMPLE', 'ASK_CHILD_TO_EXPLAIN', 'REINFORCE', 'REVIEW', 'ADVANCE', 'CHANGE_REPRESENTATION');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('CONCEPT_INTRODUCED', 'MASTERY_REACHED', 'MASTERY_LOST', 'RETENTION_PASSED', 'RETENTION_FAILED', 'MISCONCEPTION_DETECTED', 'MISCONCEPTION_RESOLVED', 'TRANSFER_DEMONSTRATED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('TUTOR', 'CHILD', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageYears" INTEGER NOT NULL,
    "gradeLabel" TEXT,
    "readingLevel" TEXT,
    "mathLevel" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strugglesWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentGrantedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "mentorName" TEXT NOT NULL DEFAULT 'Nova',
    "longitudinalNarrative" TEXT,
    "narrativeUpdatedAt" TIMESTAMP(3),
    "semanticSummary" TEXT,
    "summaryUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "learningObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonMisconceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diagnosticQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teachingStrategies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "examples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "masteryCriteria" TEXT,
    "retentionIntervalDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptEdge" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "ConceptEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerSkillState" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "independentSuccesses" INTEGER NOT NULL DEFAULT 0,
    "promptedSuccesses" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "retentionChecksPassed" INTEGER NOT NULL DEFAULT 0,
    "transferSuccesses" INTEGER NOT NULL DEFAULT 0,
    "lastTestedAt" TIMESTAMP(3),
    "nextRetentionCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerSkillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryNode" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "MemoryNodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "embedding" vector(1536),
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEdge" (
    "id" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "relationship" "MemoryRelationship" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sessionId" TEXT,
    "conceptId" TEXT,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "correctness" BOOLEAN,
    "reasoningEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasoningPattern" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hypothesis" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "conceptId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "HypothesisStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sessionId" TEXT,
    "conceptId" TEXT,
    "hypothesisId" TEXT,
    "action" "TutorAction" NOT NULL,
    "strategy" TEXT NOT NULL,
    "rationale" TEXT,
    "successful" BOOLEAN,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "conceptId" TEXT,
    "type" "LearningEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "summary" TEXT,
    "variant" TEXT NOT NULL DEFAULT 'PRIMER',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "action" "TutorAction",
    "targetConcept" TEXT,
    "rationale" TEXT,
    "safetyFlagged" BOOLEAN NOT NULL DEFAULT false,
    "safetyReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SupportingEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SupportingEvidence_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContradictingEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContradictingEvidence_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_childId_key" ON "MentorProfile"("childId");

-- CreateIndex
CREATE INDEX "Concept_domain_sequence_idx" ON "Concept"("domain", "sequence");

-- CreateIndex
CREATE INDEX "ConceptEdge_targetId_idx" ON "ConceptEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptEdge_sourceId_targetId_key" ON "ConceptEdge"("sourceId", "targetId");

-- CreateIndex
CREATE INDEX "LearnerSkillState_childId_idx" ON "LearnerSkillState"("childId");

-- CreateIndex
CREATE INDEX "LearnerSkillState_nextRetentionCheckAt_idx" ON "LearnerSkillState"("nextRetentionCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerSkillState_childId_conceptId_key" ON "LearnerSkillState"("childId", "conceptId");

-- CreateIndex
CREATE INDEX "MemoryNode_childId_type_idx" ON "MemoryNode"("childId", "type");

-- CreateIndex
CREATE INDEX "MemoryNode_childId_lastObservedAt_idx" ON "MemoryNode"("childId", "lastObservedAt");

-- CreateIndex
CREATE INDEX "MemoryEdge_targetNodeId_idx" ON "MemoryEdge"("targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryEdge_sourceNodeId_targetNodeId_relationship_key" ON "MemoryEdge"("sourceNodeId", "targetNodeId", "relationship");

-- CreateIndex
CREATE INDEX "Observation_childId_createdAt_idx" ON "Observation"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "Observation_sessionId_idx" ON "Observation"("sessionId");

-- CreateIndex
CREATE INDEX "Hypothesis_childId_status_idx" ON "Hypothesis"("childId", "status");

-- CreateIndex
CREATE INDEX "Intervention_childId_strategy_idx" ON "Intervention"("childId", "strategy");

-- CreateIndex
CREATE INDEX "Intervention_sessionId_idx" ON "Intervention"("sessionId");

-- CreateIndex
CREATE INDEX "LearningEvent_childId_createdAt_idx" ON "LearningEvent"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_childId_startedAt_idx" ON "Session"("childId", "startedAt");

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "_SupportingEvidence_B_index" ON "_SupportingEvidence"("B");

-- CreateIndex
CREATE INDEX "_ContradictingEvidence_B_index" ON "_ContradictingEvidence"("B");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptEdge" ADD CONSTRAINT "ConceptEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptEdge" ADD CONSTRAINT "ConceptEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerSkillState" ADD CONSTRAINT "LearnerSkillState_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerSkillState" ADD CONSTRAINT "LearnerSkillState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryNode" ADD CONSTRAINT "MemoryNode_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "MemoryNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEdge" ADD CONSTRAINT "MemoryEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "MemoryNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportingEvidence" ADD CONSTRAINT "_SupportingEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportingEvidence" ADD CONSTRAINT "_SupportingEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContradictingEvidence" ADD CONSTRAINT "_ContradictingEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContradictingEvidence" ADD CONSTRAINT "_ContradictingEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

