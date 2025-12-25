-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationTier" AS ENUM ('FREE', 'PROFESSIONAL', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'LEAD', 'REVIEWER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "ProjectWorkStatus" AS ENUM ('PENDING', 'SCREENING', 'CONFLICT', 'INCLUDED', 'EXCLUDED', 'MAYBE');

-- CreateEnum
CREATE TYPE "ScreeningPhase" AS ENUM ('TITLE_ABSTRACT', 'FULL_TEXT', 'FINAL');

-- CreateEnum
CREATE TYPE "ScreeningDecision" AS ENUM ('INCLUDE', 'EXCLUDE', 'MAYBE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'UPLOADING', 'PARSING', 'ENRICHING', 'DEDUPLICATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('PENDING', 'IN_DISCUSSION', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'NEEDS_DISCUSSION');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'NEEDS_REVIEW', 'VERIFIED');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "QualityToolType" AS ENUM ('ROB2', 'ROBINS_I', 'NEWCASTLE_OTTAWA', 'GRADE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'NEEDS_CONSENSUS');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REGISTERED', 'AMENDED');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('TO_READ', 'READING', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('NEW_PUBLICATION', 'CITATION_UPDATE', 'AUTHOR_ACTIVITY', 'KEYWORD_TREND', 'CUSTOM_QUERY');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "GraphType" AS ENUM ('CITATION_NETWORK', 'AUTHOR_COLLABORATION', 'CONCEPT_CLUSTER', 'TEMPORAL_EVOLUTION');

-- CreateEnum
CREATE TYPE "WritingType" AS ENUM ('LITERATURE_REVIEW', 'BACKGROUND', 'METHODS', 'RESULTS', 'DISCUSSION', 'ABSTRACT');

-- CreateEnum
CREATE TYPE "WritingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'STUDY_IMPORTED', 'SCREENING_DECISION', 'CONFLICT_RESOLVED', 'EXTRACTION_COMPLETED', 'QUALITY_ASSESSED', 'EXPORT_GENERATED', 'TEAM_MEMBER_ADDED', 'TEAM_MEMBER_REMOVED', 'SETTINGS_UPDATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'IMPORT_COMPLETED', 'EXPORT_READY', 'TEAM_INVITATION', 'MENTION', 'DEADLINE_APPROACHING', 'ALERT_DISCOVERY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "bio" TEXT,
    "orcid" TEXT,
    "institution" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "screeningDecisions" "ScreeningDecision"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "quietHoursDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alertDigestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "tier" "OrganizationTier" NOT NULL DEFAULT 'FREE',
    "maxProjects" INTEGER NOT NULL DEFAULT 3,
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "maxStudiesPerProject" INTEGER NOT NULL DEFAULT 500,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "population" TEXT,
    "intervention" TEXT,
    "comparison" TEXT,
    "outcome" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "blindScreening" BOOLEAN NOT NULL DEFAULT true,
    "requireDualScreening" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "screeningDecisions" "ScreeningDecision"[],

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'REVIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "doi" TEXT,
    "pmid" TEXT,
    "pmcid" TEXT,
    "openAlexId" TEXT,
    "semanticScholarId" TEXT,
    "arxivId" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "authors" JSONB NOT NULL DEFAULT '[]',
    "year" INTEGER,
    "publicationDate" TIMESTAMP(3),
    "journal" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "publisher" TEXT,
    "url" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meshTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'import',
    "enrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWork" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "importSource" TEXT,
    "rawRecord" JSONB,
    "status" "ProjectWorkStatus" NOT NULL DEFAULT 'PENDING',
    "phase" "ScreeningPhase" NOT NULL DEFAULT 'TITLE_ABSTRACT',
    "finalDecision" "ScreeningDecision",
    "aiSuggestion" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiReasoning" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningDecisionRecord" (
    "id" TEXT NOT NULL,
    "projectWorkId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "phase" "ScreeningPhase" NOT NULL,
    "decision" "ScreeningDecision" NOT NULL,
    "reasoning" TEXT,
    "exclusionReason" TEXT,
    "confidence" INTEGER,
    "aiSuggestion" "ScreeningDecision",
    "aiConfidence" DOUBLE PRECISION,
    "aiReasoning" TEXT,
    "followedAi" BOOLEAN,
    "timeSpentMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningDecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectWorkId" TEXT NOT NULL,
    "phase" "ScreeningPhase" NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'PENDING',
    "decisions" JSONB NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "escalatedBy" TEXT,
    "escalationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictResolution" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "resolverId" TEXT NOT NULL,
    "finalDecision" "ScreeningDecision" NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRound" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "ScreeningPhase" NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 20,
    "targetAgreement" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'PENDING',
    "kappaScore" DOUBLE PRECISION,
    "percentAgreement" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDecision" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "projectWorkId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ScreeningDecision" NOT NULL,
    "reasoning" TEXT,
    "timeSpentMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionData" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectWorkId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "extractorId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "ExtractionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validationErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionDiscrepancy" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value1" TEXT,
    "value2" TEXT,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedValue" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ExtractionDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAssessmentTool" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "QualityToolType" NOT NULL,
    "domains" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityAssessmentTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAssessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectWorkId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "domainScores" JSONB NOT NULL DEFAULT '{}',
    "overallScore" TEXT,
    "overallJustification" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewProtocol" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL DEFAULT '{}',
    "prosperoId" TEXT,
    "registrationDate" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolVersion" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "changeLog" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolMilestone" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProtocolMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivingReviewConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updateFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "lastUpdateAt" TIMESTAMP(3),
    "nextUpdateAt" TIMESTAMP(3),
    "searchStrategies" JSONB NOT NULL DEFAULT '[]',
    "dataSources" JSONB NOT NULL DEFAULT '["openalex", "pubmed"]',
    "autoScreenEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoExcludeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.95,

    CONSTRAINT "LivingReviewConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivingReviewUpdate" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "newStudiesFound" INTEGER NOT NULL DEFAULT 0,
    "studiesAdded" INTEGER NOT NULL DEFAULT 0,
    "autoExcluded" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LivingReviewUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "folderId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "rating" INTEGER,
    "readingStatus" "ReadingStatus" NOT NULL DEFAULT 'TO_READ',
    "highlightColor" TEXT,
    "aiSummary" TEXT,
    "aiKeyInsights" JSONB,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alertType" "AlertType" NOT NULL,
    "searchQuery" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "journals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDiscovery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "workId" TEXT,
    "title" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isActioned" BOOLEAN NOT NULL DEFAULT false,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGraph" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "graphType" "GraphType" NOT NULL DEFAULT 'CITATION_NETWORK',
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "layoutData" JSONB,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "workId" TEXT,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "position" JSONB,

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "type" "WritingType" NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "citationStyle" TEXT NOT NULL DEFAULT 'APA',
    "targetLength" INTEGER,
    "status" "WritingStatus" NOT NULL DEFAULT 'DRAFT',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSource" (
    "id" TEXT NOT NULL,
    "writingProjectId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "citationKey" TEXT,
    "notes" TEXT,
    "usedInSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyUsage" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "responseTime" INTEGER,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "result" JSONB,
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_orcid_key" ON "User"("orcid");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_token_key" ON "OrganizationInvitation"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_token_idx" ON "OrganizationInvitation"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_slug_idx" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Work_doi_key" ON "Work"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Work_pmid_key" ON "Work"("pmid");

-- CreateIndex
CREATE UNIQUE INDEX "Work_openAlexId_key" ON "Work"("openAlexId");

-- CreateIndex
CREATE INDEX "Work_doi_idx" ON "Work"("doi");

-- CreateIndex
CREATE INDEX "Work_pmid_idx" ON "Work"("pmid");

-- CreateIndex
CREATE INDEX "Work_openAlexId_idx" ON "Work"("openAlexId");

-- CreateIndex
CREATE INDEX "Work_title_idx" ON "Work"("title");

-- CreateIndex
CREATE INDEX "ProjectWork_projectId_status_idx" ON "ProjectWork"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectWork_projectId_phase_idx" ON "ProjectWork"("projectId", "phase");

-- CreateIndex
CREATE INDEX "ProjectWork_importBatchId_idx" ON "ProjectWork"("importBatchId");

-- CreateIndex
CREATE INDEX "ProjectWork_aiConfidence_idx" ON "ProjectWork"("aiConfidence");

-- CreateIndex
CREATE INDEX "ProjectWork_priorityScore_idx" ON "ProjectWork"("priorityScore");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWork_projectId_workId_key" ON "ProjectWork"("projectId", "workId");

-- CreateIndex
CREATE INDEX "ImportBatch_projectId_idx" ON "ImportBatch"("projectId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ScreeningDecisionRecord_projectWorkId_idx" ON "ScreeningDecisionRecord"("projectWorkId");

-- CreateIndex
CREATE INDEX "ScreeningDecisionRecord_reviewerId_idx" ON "ScreeningDecisionRecord"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningDecisionRecord_projectWorkId_reviewerId_phase_key" ON "ScreeningDecisionRecord"("projectWorkId", "reviewerId", "phase");

-- CreateIndex
CREATE INDEX "Conflict_projectId_status_idx" ON "Conflict"("projectId", "status");

-- CreateIndex
CREATE INDEX "Conflict_projectWorkId_idx" ON "Conflict"("projectWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolution_conflictId_key" ON "ConflictResolution"("conflictId");

-- CreateIndex
CREATE INDEX "CalibrationRound_projectId_idx" ON "CalibrationRound"("projectId");

-- CreateIndex
CREATE INDEX "CalibrationDecision_roundId_idx" ON "CalibrationDecision"("roundId");

-- CreateIndex
CREATE INDEX "ExtractionTemplate_projectId_idx" ON "ExtractionTemplate"("projectId");

-- CreateIndex
CREATE INDEX "ExtractionData_projectId_idx" ON "ExtractionData"("projectId");

-- CreateIndex
CREATE INDEX "ExtractionData_projectWorkId_idx" ON "ExtractionData"("projectWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionData_projectWorkId_templateId_extractorId_key" ON "ExtractionData"("projectWorkId", "templateId", "extractorId");

-- CreateIndex
CREATE INDEX "ExtractionDiscrepancy_extractionId_idx" ON "ExtractionDiscrepancy"("extractionId");

-- CreateIndex
CREATE INDEX "QualityAssessmentTool_projectId_idx" ON "QualityAssessmentTool"("projectId");

-- CreateIndex
CREATE INDEX "QualityAssessment_projectId_idx" ON "QualityAssessment"("projectId");

-- CreateIndex
CREATE INDEX "QualityAssessment_projectWorkId_idx" ON "QualityAssessment"("projectWorkId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityAssessment_projectWorkId_toolId_assessorId_key" ON "QualityAssessment"("projectWorkId", "toolId", "assessorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewProtocol_projectId_key" ON "ReviewProtocol"("projectId");

-- CreateIndex
CREATE INDEX "ProtocolVersion_protocolId_idx" ON "ProtocolVersion"("protocolId");

-- CreateIndex
CREATE INDEX "ProtocolMilestone_protocolId_idx" ON "ProtocolMilestone"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "LivingReviewConfig_projectId_key" ON "LivingReviewConfig"("projectId");

-- CreateIndex
CREATE INDEX "LivingReviewUpdate_configId_idx" ON "LivingReviewUpdate"("configId");

-- CreateIndex
CREATE INDEX "LibraryItem_userId_idx" ON "LibraryItem"("userId");

-- CreateIndex
CREATE INDEX "LibraryItem_folderId_idx" ON "LibraryItem"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userId_workId_key" ON "LibraryItem"("userId", "workId");

-- CreateIndex
CREATE INDEX "LibraryFolder_userId_idx" ON "LibraryFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFolder_userId_name_parentId_key" ON "LibraryFolder"("userId", "name", "parentId");

-- CreateIndex
CREATE INDEX "ResearchAlert_userId_idx" ON "ResearchAlert"("userId");

-- CreateIndex
CREATE INDEX "ResearchAlert_projectId_idx" ON "ResearchAlert"("projectId");

-- CreateIndex
CREATE INDEX "AlertDiscovery_alertId_idx" ON "AlertDiscovery"("alertId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGraph_shareToken_key" ON "ResearchGraph"("shareToken");

-- CreateIndex
CREATE INDEX "ResearchGraph_userId_idx" ON "ResearchGraph"("userId");

-- CreateIndex
CREATE INDEX "ResearchGraph_projectId_idx" ON "ResearchGraph"("projectId");

-- CreateIndex
CREATE INDEX "GraphNode_graphId_idx" ON "GraphNode"("graphId");

-- CreateIndex
CREATE INDEX "WritingProject_userId_idx" ON "WritingProject"("userId");

-- CreateIndex
CREATE INDEX "WritingProject_projectId_idx" ON "WritingProject"("projectId");

-- CreateIndex
CREATE INDEX "WritingSource_writingProjectId_idx" ON "WritingSource"("writingProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSource_writingProjectId_workId_key" ON "WritingSource"("writingProjectId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKeyUsage_apiKeyId_createdAt_idx" ON "ApiKeyUsage"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "Webhook_organizationId_idx" ON "Webhook"("organizationId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_projectId_idx" ON "Activity"("projectId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_projectId_createdAt_idx" ON "ChatMessage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");

-- CreateIndex
CREATE INDEX "Job_scheduledAt_idx" ON "Job"("scheduledAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWork" ADD CONSTRAINT "ProjectWork_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWork" ADD CONSTRAINT "ProjectWork_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWork" ADD CONSTRAINT "ProjectWork_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWork" ADD CONSTRAINT "ProjectWork_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "ProjectWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningDecisionRecord" ADD CONSTRAINT "ScreeningDecisionRecord_projectWorkId_fkey" FOREIGN KEY ("projectWorkId") REFERENCES "ProjectWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_projectWorkId_fkey" FOREIGN KEY ("projectWorkId") REFERENCES "ProjectWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "Conflict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRound" ADD CONSTRAINT "CalibrationRound_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationDecision" ADD CONSTRAINT "CalibrationDecision_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CalibrationRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionTemplate" ADD CONSTRAINT "ExtractionTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionData" ADD CONSTRAINT "ExtractionData_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionData" ADD CONSTRAINT "ExtractionData_projectWorkId_fkey" FOREIGN KEY ("projectWorkId") REFERENCES "ProjectWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionData" ADD CONSTRAINT "ExtractionData_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExtractionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionData" ADD CONSTRAINT "ExtractionData_extractorId_fkey" FOREIGN KEY ("extractorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionDiscrepancy" ADD CONSTRAINT "ExtractionDiscrepancy_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "ExtractionData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessmentTool" ADD CONSTRAINT "QualityAssessmentTool_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessment" ADD CONSTRAINT "QualityAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessment" ADD CONSTRAINT "QualityAssessment_projectWorkId_fkey" FOREIGN KEY ("projectWorkId") REFERENCES "ProjectWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessment" ADD CONSTRAINT "QualityAssessment_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "QualityAssessmentTool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessment" ADD CONSTRAINT "QualityAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewProtocol" ADD CONSTRAINT "ReviewProtocol_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "ReviewProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolMilestone" ADD CONSTRAINT "ProtocolMilestone_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "ReviewProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivingReviewConfig" ADD CONSTRAINT "LivingReviewConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivingReviewUpdate" ADD CONSTRAINT "LivingReviewUpdate_configId_fkey" FOREIGN KEY ("configId") REFERENCES "LivingReviewConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LibraryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchAlert" ADD CONSTRAINT "ResearchAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchAlert" ADD CONSTRAINT "ResearchAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDiscovery" ADD CONSTRAINT "AlertDiscovery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "ResearchAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGraph" ADD CONSTRAINT "ResearchGraph_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGraph" ADD CONSTRAINT "ResearchGraph_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "ResearchGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingProject" ADD CONSTRAINT "WritingProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingProject" ADD CONSTRAINT "WritingProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSource" ADD CONSTRAINT "WritingSource_writingProjectId_fkey" FOREIGN KEY ("writingProjectId") REFERENCES "WritingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSource" ADD CONSTRAINT "WritingSource_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
