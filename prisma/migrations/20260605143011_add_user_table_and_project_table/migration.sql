/*
  Warnings:

  - You are about to drop the column `userEmail` on the `Document` table. All the data in the column will be lost.
  - The primary key for the `Notification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `docId` on the `Notification` table. All the data in the column will be lost.
  - The `id` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `projectId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `documentId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `Notification` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Document_userId_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "userEmail",
ADD COLUMN     "projectId" INTEGER NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey",
DROP COLUMN "docId",
ADD COLUMN     "documentId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
