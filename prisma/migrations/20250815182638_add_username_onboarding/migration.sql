/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('NEED_USERNAME', 'NEED_TEAM', 'READY');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "OnboardingStep" "public"."OnboardingStep" NOT NULL DEFAULT 'NEED_USERNAME',
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");
