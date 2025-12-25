/**
 * Central type exports
 */

// API Types
export * from "./api";

// Domain Types
export * from "./project";
export * from "./screening";
// Export work types explicitly to avoid conflicts
export type { 
  Work as WorkEntity,
  WorkAuthor, 
  WorkWithDetails, 
  WorkSearchResult, 
  WorkSource,
  OpenAlexWork,
  OpenAlexAuthorship,
  WorkTransformer,
  PubMedArticle,
  CrossrefWork,
  CreateWorkInput,
  UpdateWorkInput,
  WorkEnrichmentResult,
} from "./work";
export * from "./library";
export * from "./extraction";

// Re-export commonly used Prisma types
export type {
  User,
  Organization,
  OrganizationMember,
  Project,
  ProjectMember,
  Work,
  ProjectWork,
  ImportBatch,
  Conflict,
  ExtractionTemplate,
  ExtractionData,
  QualityAssessmentTool,
  QualityAssessment,
  LibraryItem,
  LibraryFolder,
  ResearchAlert,
  ResearchGraph,
  WritingProject,
  Notification,
  Activity,
} from "@prisma/client";

// Re-export all enums
export {
  UserRole,
  OrganizationTier,
  OrganizationRole,
  ProjectStatus,
  ProjectRole,
  ProjectWorkStatus,
  ScreeningPhase,
  ScreeningDecision,
  ImportStatus,
  ConflictStatus,
  CalibrationStatus,
  ExtractionStatus,
  DiscrepancyStatus,
  QualityToolType,
  AssessmentStatus,
  ProtocolStatus,
  ReadingStatus,
  AlertType,
  AlertFrequency,
  GraphType,
  WritingType,
  WritingStatus,
  WebhookDeliveryStatus,
  ActivityType,
  NotificationType,
  JobStatus,
} from "@prisma/client";
