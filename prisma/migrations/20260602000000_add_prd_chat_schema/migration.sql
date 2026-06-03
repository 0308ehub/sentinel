-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('GMAIL', 'SLACK', 'LINEAR', 'JIRA', 'INTERCOM', 'ZENDESK', 'HUBSPOT', 'NOTION');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ERROR', 'NEEDS_REAUTH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentSourceType" ADD VALUE 'EMAIL';
ALTER TYPE "DocumentSourceType" ADD VALUE 'SLACK';
ALTER TYPE "DocumentSourceType" ADD VALUE 'LINEAR';
ALTER TYPE "DocumentSourceType" ADD VALUE 'JIRA';
ALTER TYPE "DocumentSourceType" ADD VALUE 'INTERCOM';
ALTER TYPE "DocumentSourceType" ADD VALUE 'ZENDESK';
ALTER TYPE "DocumentSourceType" ADD VALUE 'HUBSPOT';

-- DropForeignKey
ALTER TABLE "SentinelAction" DROP CONSTRAINT "SentinelAction_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceSettings" DROP CONSTRAINT "WorkspaceSettings_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "prdId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "connectorId" TEXT,
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "SentinelAction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSyncLog" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentsImported" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectorSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "Conversation_prdId_idx" ON "Conversation"("prdId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_prdId_userId_key" ON "Conversation"("prdId", "userId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSyncLog" ADD CONSTRAINT "ConnectorSyncLog_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_prdId_fkey" FOREIGN KEY ("prdId") REFERENCES "PRD"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentinelAction" ADD CONSTRAINT "SentinelAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
