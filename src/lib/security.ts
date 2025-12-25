/**
 * Security Utilities
 * Input sanitization, validation, and security helpers
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ============== INPUT SANITIZATION ==============

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip HTML tags completely
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize for use in SQL LIKE queries
 */
export function sanitizeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
}

/**
 * Sanitize URL path
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, "") // Prevent directory traversal
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/");
}

// ============== VALIDATION ==============

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate DOI format
 */
export function isValidDoi(doi: string): boolean {
  // DOI pattern: 10.xxxx/xxxxx
  const doiRegex = /^10\.\d{4,}\/[^\s]+$/;
  return doiRegex.test(doi);
}

/**
 * Validate CUID format
 */
export function isValidCuid(id: string): boolean {
  // CUID is typically 25 characters, starts with 'c'
  return /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============== CRYPTOGRAPHIC HELPERS ==============

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a URL-safe token
 */
export function generateUrlSafeToken(length = 32): string {
  return randomBytes(length).toString("base64url");
}

/**
 * Hash a value with SHA-256
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Hash a value with SHA-512
 */
export function sha512(value: string): string {
  return createHash("sha512").update(value).digest("hex");
}

/**
 * Timing-safe string comparison
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return timingSafeEqual(bufA, bufB);
}

// ============== REQUEST SECURITY ==============

/**
 * Extract client IP from request
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Validate origin for CORS
 */
export function isValidOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes("*")) {
    return true;
  }

  return allowedOrigins.some((allowed) => {
    if (allowed.startsWith("*.")) {
      // Wildcard subdomain
      const domain = allowed.substring(2);
      return origin.endsWith(domain) || origin === `https://${domain}`;
    }
    return origin === allowed;
  });
}

/**
 * Check for common attack patterns in input
 */
export function detectSuspiciousInput(input: string): boolean {
  const suspiciousPatterns = [
    // SQL injection
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i,
    // XSS
    /<script\b[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    // Path traversal
    /\.\.\//,
    // Command injection
    /[;&|`$]/,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

// ============== CONTENT SECURITY ==============

/**
 * Generate Content Security Policy header value
 */
export function generateCSP(options: {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  frameSrc?: string[];
  reportUri?: string;
}): string {
  const directives: string[] = [];

  const defaults = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    frameSrc: ["'none'"],
  };

  const merged = { ...defaults, ...options };

  if (merged.defaultSrc) {
    directives.push(`default-src ${merged.defaultSrc.join(" ")}`);
  }
  if (merged.scriptSrc) {
    directives.push(`script-src ${merged.scriptSrc.join(" ")}`);
  }
  if (merged.styleSrc) {
    directives.push(`style-src ${merged.styleSrc.join(" ")}`);
  }
  if (merged.imgSrc) {
    directives.push(`img-src ${merged.imgSrc.join(" ")}`);
  }
  if (merged.connectSrc) {
    directives.push(`connect-src ${merged.connectSrc.join(" ")}`);
  }
  if (merged.fontSrc) {
    directives.push(`font-src ${merged.fontSrc.join(" ")}`);
  }
  if (merged.frameSrc) {
    directives.push(`frame-src ${merged.frameSrc.join(" ")}`);
  }
  if (options.reportUri) {
    directives.push(`report-uri ${options.reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Generate security headers for response
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

// ============== DATA MASKING ==============

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";

  const maskedLocal =
    local.length > 2
      ? local[0] + "*".repeat(local.length - 2) + local[local.length - 1]
      : "*".repeat(local.length);

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask API key (show prefix only)
 */
export function maskApiKey(key: string, showPrefix = 8): string {
  if (key.length <= showPrefix) {
    return "*".repeat(key.length);
  }
  return key.substring(0, showPrefix) + "*".repeat(Math.min(24, key.length - showPrefix));
}

/**
 * Redact sensitive fields from object
 */
export function redactSensitive<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[] = ["password", "token", "secret", "apiKey", "key"]
): T {
  const redacted = { ...obj };

  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field as keyof T] = "[REDACTED]" as T[keyof T];
    }
  }

  return redacted;
}

