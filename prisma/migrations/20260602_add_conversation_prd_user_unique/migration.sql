-- AlterTable
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_prdId_userId_key" UNIQUE("prdId", "userId");
