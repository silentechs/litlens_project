/**
 * Error to User Message Mapping
 * Converts API error codes to user-friendly messages
 */

import { toast } from "sonner";
import type { ErrorCode } from "@/types/api";

// ============== ERROR MESSAGE MAPPINGS ==============

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check your input and try again.",
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "This action conflicts with existing data.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  SERVER_ERROR: "Something went wrong on our end. Please try again later.",
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  BAD_REQUEST: "Invalid request. Please try again.",
  UNPROCESSABLE_ENTITY: "Unable to process this request.",
  SERVICE_UNAVAILABLE: "This service is temporarily unavailable.",
  UNKNOWN: "An unexpected error occurred.",
};

// Context-specific messages
const CONTEXT_MESSAGES: Record<string, Record<ErrorCode, string>> = {
  screening: {
    VALIDATION_ERROR: "Invalid screening decision. Please try again.",
    CONFLICT: "This study has already been screened.",
    NOT_FOUND: "Study not found in the queue.",
    FORBIDDEN: "You don't have permission to screen in this project.",
    UNAUTHORIZED: "Please sign in to continue screening.",
    RATE_LIMITED: "Too many requests. Please wait a moment.",
    SERVER_ERROR: "Unable to save your decision. Please try again.",
    NETWORK_ERROR: "Connection lost. Your decision will be saved when reconnected.",
    BAD_REQUEST: "Invalid screening request.",
    UNPROCESSABLE_ENTITY: "Unable to process screening decision.",
    SERVICE_UNAVAILABLE: "Screening service is temporarily unavailable.",
    UNKNOWN: "An error occurred while screening.",
  },
  import: {
    VALIDATION_ERROR: "Invalid file format. Please use RIS, BibTeX, or CSV.",
    CONFLICT: "Some studies are already in this project.",
    NOT_FOUND: "Project not found.",
    FORBIDDEN: "You don't have permission to import studies.",
    UNAUTHORIZED: "Please sign in to import studies.",
    RATE_LIMITED: "Too many imports. Please wait before trying again.",
    SERVER_ERROR: "Import failed. Please try again.",
    NETWORK_ERROR: "Upload interrupted. Please check your connection.",
    BAD_REQUEST: "Invalid import request.",
    UNPROCESSABLE_ENTITY: "Unable to process this file.",
    SERVICE_UNAVAILABLE: "Import service is temporarily unavailable.",
    UNKNOWN: "An error occurred during import.",
  },
  library: {
    VALIDATION_ERROR: "Invalid library item.",
    CONFLICT: "This paper is already in your library.",
    NOT_FOUND: "Paper not found.",
    FORBIDDEN: "Unable to access this library item.",
    UNAUTHORIZED: "Please sign in to manage your library.",
    RATE_LIMITED: "Too many requests. Please wait a moment.",
    SERVER_ERROR: "Unable to update library. Please try again.",
    NETWORK_ERROR: "Connection lost. Changes will sync when reconnected.",
    BAD_REQUEST: "Invalid library request.",
    UNPROCESSABLE_ENTITY: "Unable to process library update.",
    SERVICE_UNAVAILABLE: "Library service is temporarily unavailable.",
    UNKNOWN: "An error occurred with your library.",
  },
};

// ============== MAIN FUNCTION ==============

/**
 * Convert an API error code to a user-friendly message
 */
export function toUserMessage(
  code: ErrorCode,
  context?: string
): string {
  // Try context-specific message first
  if (context && CONTEXT_MESSAGES[context]) {
    return CONTEXT_MESSAGES[context][code] || ERROR_MESSAGES[code];
  }
  
  return ERROR_MESSAGES[code];
}

// ============== TOAST HELPERS ==============

/**
 * Show an error toast with a user-friendly message
 */
export function showErrorToast(
  code: ErrorCode,
  context?: string,
  title?: string
) {
  const message = toUserMessage(code, context);
  
  toast.error(title || "Error", {
    description: message,
  });
}

/**
 * Show a success toast
 */
export function showSuccessToast(
  message: string,
  title?: string
) {
  toast.success(title || "Success", {
    description: message,
  });
}

/**
 * Show an info toast
 */
export function showInfoToast(
  message: string,
  title?: string
) {
  toast.info(title || "Info", {
    description: message,
  });
}

/**
 * Show a warning toast
 */
export function showWarningToast(
  message: string,
  title?: string
) {
  toast.warning(title || "Warning", {
    description: message,
  });
}

// ============== ERROR HANDLER FOR MUTATIONS ==============

/**
 * Create an onError handler for mutations
 */
export function createErrorHandler(context?: string) {
  return (error: unknown) => {
    console.error("Mutation error:", error);
    
    // Try to extract error code from API response
    if (error instanceof Error) {
      const message = error.message;
      
      // Check if it's a known error code
      if (message in ERROR_MESSAGES) {
        showErrorToast(message as ErrorCode, context);
        return;
      }
    }
    
    // Default error
    showErrorToast("UNKNOWN", context);
  };
}

