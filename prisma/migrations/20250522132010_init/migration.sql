/*
  Warnings:

  - You are about to drop the column `startTime` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "startTime",
ADD COLUMN     "endTime" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatId" TEXT;
