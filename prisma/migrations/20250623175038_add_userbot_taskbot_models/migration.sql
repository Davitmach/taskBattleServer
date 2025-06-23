/*
  Warnings:

  - You are about to drop the `_UserTasks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_UserTasks" DROP CONSTRAINT "_UserTasks_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserTasks" DROP CONSTRAINT "_UserTasks_B_fkey";

-- AlterTable
ALTER TABLE "UserBot" ADD COLUMN     "name" TEXT,
ALTER COLUMN "username" DROP NOT NULL;

-- DropTable
DROP TABLE "_UserTasks";

-- CreateTable
CREATE TABLE "TaskExecutor" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskExecutor_pkey" PRIMARY KEY ("taskId","userId")
);

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskBot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutor" ADD CONSTRAINT "TaskExecutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserBot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
