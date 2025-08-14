-- CreateEnum
CREATE TYPE "public"."Position" AS ENUM ('GK', 'DF', 'MD', 'FW');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL DEFAULT 500000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" "public"."Position" NOT NULL,
    "skill" INTEGER NOT NULL,
    "tactic" INTEGER NOT NULL,
    "physical" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferListing" (
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "askingPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "public"."Transfer" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sellerTeamId" TEXT NOT NULL,
    "buyerTeamId" TEXT NOT NULL,
    "askingPriceCents" INTEGER NOT NULL,
    "soldPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotSkill" INTEGER NOT NULL,
    "snapshotTactic" INTEGER NOT NULL,
    "snapshotPhysical" INTEGER NOT NULL,
    "snapshotPosition" "public"."Position" NOT NULL,
    "buyerBalanceBefore" INTEGER NOT NULL,
    "buyerBalanceAfter" INTEGER NOT NULL,
    "sellerBalanceBefore" INTEGER NOT NULL,
    "sellerBalanceAfter" INTEGER NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "public"."OAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_userId_key" ON "public"."Team"("userId");

-- CreateIndex
CREATE INDEX "TransferListing_teamId_idx" ON "public"."TransferListing"("teamId");

-- CreateIndex
CREATE INDEX "Transfer_buyerTeamId_idx" ON "public"."Transfer"("buyerTeamId");

-- CreateIndex
CREATE INDEX "Transfer_sellerTeamId_idx" ON "public"."Transfer"("sellerTeamId");

-- AddForeignKey
ALTER TABLE "public"."OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferListing" ADD CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferListing" ADD CONSTRAINT "TransferListing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
