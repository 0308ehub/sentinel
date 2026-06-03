-- CreateEnum
CREATE TYPE "DigestType" AS ENUM ('DAILY', 'WEEKLY', 'MANUAL');

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "DigestType" NOT NULL DEFAULT 'DAILY',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Digest_workspaceId_idx" ON "Digest"("workspaceId");

-- AddForeignKey
ALTER TABLE "Digest" ADD CONSTRAINT "Digest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "digestId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_digestId_idx" ON "Conversation"("digestId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Conversation_digestId_userId_key" ON "Conversation"("digestId", "userId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "Digest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
