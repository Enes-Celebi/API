/*
  Warnings:

  - You are about to drop the column `OnboardingStep` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."OnboardingStep" ADD VALUE 'CREATING_TEAM';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "OnboardingStep",
ADD COLUMN     "onboardingStep" "public"."OnboardingStep" NOT NULL DEFAULT 'NEED_USERNAME';
