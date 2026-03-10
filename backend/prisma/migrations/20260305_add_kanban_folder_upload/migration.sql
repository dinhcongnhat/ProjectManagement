-- AlterTable
ALTER TABLE "KanbanAttachment" ADD COLUMN "isFolder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KanbanAttachment" ADD COLUMN "folderName" TEXT;
ALTER TABLE "KanbanAttachment" ADD COLUMN "relativePath" TEXT;

-- CreateIndex
CREATE INDEX "KanbanAttachment_folderName_idx" ON "KanbanAttachment"("folderName");
