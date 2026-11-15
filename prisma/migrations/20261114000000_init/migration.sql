-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "avatarUrl" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "interests" TEXT NOT NULL DEFAULT '[]',
    "goals" TEXT NOT NULL DEFAULT '[]',
    "freeSlots" TEXT NOT NULL DEFAULT '[]',
    "tagWeights" TEXT NOT NULL DEFAULT '{}',
    "slotWeights" TEXT NOT NULL DEFAULT '{}',
    "typeWeights" TEXT NOT NULL DEFAULT '{}',
    "scheduleImportedAt" DATETIME,
    "profileEmbedding" TEXT NOT NULL DEFAULT '[]',
    "profileSentence" TEXT,
    "profileSwipeMark" INTEGER NOT NULL DEFAULT 0,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "day" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleBlock_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    CONSTRAINT "Friendship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "accessible" BOOLEAN NOT NULL DEFAULT true,
    "costPerHour" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "foodType" TEXT NOT NULL DEFAULT 'none',
    "goodies" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "endDate" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "budget" REAL NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "venueId" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "campus" TEXT NOT NULL DEFAULT 'UPC',
    "format" TEXT NOT NULL DEFAULT 'in-person',
    "virtualUrl" TEXT,
    "websiteUrl" TEXT,
    "registrationUrl" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'other',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "restrictions" TEXT NOT NULL DEFAULT '[]',
    "coHosts" TEXT NOT NULL DEFAULT '[]',
    "agenda" TEXT NOT NULL DEFAULT '[]',
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketCost" REAL NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "accessibilityNotes" TEXT NOT NULL DEFAULT '',
    "flyerHeadline" TEXT NOT NULL DEFAULT '',
    "flyerTagline" TEXT NOT NULL DEFAULT '',
    "flyerColor" TEXT NOT NULL DEFAULT '#990000',
    "flyerImageUrl" TEXT,
    "cardBlurb" TEXT NOT NULL DEFAULT '',
    "detailedSummary" TEXT,
    "embedding" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT,
    "matchPct" INTEGER,
    "rankPos" INTEGER,
    "dwellMs" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'feed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Swipe_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Swipe_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pre-registered',
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "feedbackThemes" TEXT NOT NULL DEFAULT '[]',
    "swipeInsights" TEXT NOT NULL DEFAULT '{}',
    "keepChange" TEXT NOT NULL DEFAULT '{"keep":[],"change":[]}',
    "embedding" TEXT NOT NULL DEFAULT '[]',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_studentId_friendId_key" ON "Friendship"("studentId", "friendId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_studentId_eventId_key" ON "Swipe"("studentId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_studentId_eventId_key" ON "Registration"("studentId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_studentId_eventId_key" ON "CheckIn"("studentId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecord_eventId_key" ON "EventRecord"("eventId");

