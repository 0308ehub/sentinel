-- CreateTable
CREATE TABLE "InterviewGuide" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerSegment" TEXT NOT NULL,
    "interviewType" TEXT NOT NULL,
    "focusArea" TEXT,
    "openingStatement" TEXT NOT NULL,
    "closingStatement" TEXT NOT NULL,
    "synthesis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "probe" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "intervieweeName" TEXT NOT NULL,
    "intervieweeRole" TEXT,
    "intervieweeCompany" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewGuide_workspaceId_idx" ON "InterviewGuide"("workspaceId");

-- CreateIndex
CREATE INDEX "InterviewQuestion_guideId_idx" ON "InterviewQuestion"("guideId");

-- CreateIndex
CREATE INDEX "InterviewSession_guideId_idx" ON "InterviewSession"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_sessionId_questionId_key" ON "SessionNote"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "SessionNote_sessionId_idx" ON "SessionNote"("sessionId");

-- AddForeignKey
ALTER TABLE "InterviewGuide" ADD CONSTRAINT "InterviewGuide_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "InterviewGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "InterviewGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
