-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACCEPTED', 'PENDING');

-- AlterTable
ALTER TABLE "TaskParticipant" ADD COLUMN     "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING';
