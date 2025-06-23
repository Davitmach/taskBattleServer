/*
  Warnings:

  - You are about to drop the column `groupChatId` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TaskStatusBot" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "groupChatId";

-- CreateTable
CREATE TABLE "UserBot" (
    "id" TEXT NOT NULL,
    "tgId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBot" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TaskStatusBot" NOT NULL DEFAULT 'IN_PROGRESS',
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "TaskBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserTasks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBot_tgId_key" ON "UserBot"("tgId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBot_username_key" ON "UserBot"("username");

-- CreateIndex
CREATE INDEX "_UserTasks_B_index" ON "_UserTasks"("B");

-- AddForeignKey
ALTER TABLE "TaskBot" ADD CONSTRAINT "TaskBot_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UserBot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "TaskBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTasks" ADD CONSTRAINT "_UserTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "UserBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
