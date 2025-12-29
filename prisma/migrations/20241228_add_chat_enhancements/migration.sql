-- Add enhanced chat features
-- Message editing/deletion, file attachments, reactions, read receipts

-- Add new fields to ChatMessage
ALTER TABLE "ChatMessage" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "editedAt" TIMESTAMP(3);

-- Create ChatAttachment table
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- Create ChatReaction table
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- Create ChatReadReceipt table
CREATE TABLE "ChatReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReadReceipt_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");

CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");
CREATE INDEX "ChatReaction_userId_idx" ON "ChatReaction"("userId");
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_emoji_key" ON "ChatReaction"("messageId", "userId", "emoji");

CREATE INDEX "ChatReadReceipt_messageId_idx" ON "ChatReadReceipt"("messageId");
CREATE INDEX "ChatReadReceipt_userId_idx" ON "ChatReadReceipt"("userId");
CREATE UNIQUE INDEX "ChatReadReceipt_messageId_userId_key" ON "ChatReadReceipt"("messageId", "userId");

-- Add foreign keys
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReadReceipt" ADD CONSTRAINT "ChatReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReadReceipt" ADD CONSTRAINT "ChatReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

