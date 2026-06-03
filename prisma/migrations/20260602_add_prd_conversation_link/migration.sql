-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "prdId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_prdId_idx" ON "Conversation"("prdId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_prdId_fkey" FOREIGN KEY ("prdId") REFERENCES "PRD"("id") ON DELETE CASCADE ON UPDATE CASCADE;
