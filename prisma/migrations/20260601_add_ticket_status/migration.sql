-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('BACKLOG', 'IN_SPRINT', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- AlterTable
ALTER TABLE "EngineeringTicket"
  ADD COLUMN "status" "TicketStatus" NOT NULL DEFAULT 'BACKLOG',
  ADD COLUMN "externalLinearId" TEXT,
  ADD COLUMN "externalLinearUrl" TEXT;
