-- AlterTable: Add note fields to Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastNoteAt" TIMESTAMP(3);

-- AlterTable: Add createdById to Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdById" INTEGER;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Project_createdById_fkey'
    ) THEN
        ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Update existing projects: Set createdById to managerId for backward compatibility
UPDATE "Project" SET "createdById" = "managerId" WHERE "createdById" IS NULL;
