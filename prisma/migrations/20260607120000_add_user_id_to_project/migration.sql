-- AlterTable
ALTER TABLE "Project" ADD COLUMN "userId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Remove orphaned projects (no owner) before enforcing NOT NULL
DELETE FROM "Project" WHERE "userId" IS NULL;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce NOT NULL after cleanup
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
