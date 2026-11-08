CREATE TABLE "github_profile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "name" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "github_profile_ownerId_githubId_key" ON "github_profile"("ownerId", "githubId");
CREATE INDEX "github_profile_ownerId_createdAt_idx" ON "github_profile"("ownerId", "createdAt");
