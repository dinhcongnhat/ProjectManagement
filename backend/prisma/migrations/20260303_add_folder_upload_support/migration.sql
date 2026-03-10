-- AlterTable
ALTER TABLE "ProjectAttachment" ADD COLUMN "isFolder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectAttachment" ADD COLUMN "folderName" TEXT;
ALTER TABLE "ProjectAttachment" ADD COLUMN "relativePath" TEXT;

-- CreateIndex
CREATE INDEX "ProjectAttachment_folderName_idx" ON "ProjectAttachment"("folderName");
