/**
 * Cloudflare R2 Storage Utilities
 * R2 is S3-compatible, so we use the AWS SDK
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============== CLIENT CONFIGURATION ==============

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN; // Optional custom domain

// Create S3-compatible client for R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ============== FILE UPLOAD ==============

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

/**
 * Upload a file to R2
 */
export async function uploadFile({
  key,
  body,
  contentType,
  metadata,
  isPublic = false,
}: UploadOptions): Promise<{ url: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
    // R2 doesn't support ACL, use public domain for public files
  });

  await r2Client.send(command);

  // Return public URL if using public domain, otherwise return key
  const url = isPublic && R2_PUBLIC_DOMAIN
    ? `${R2_PUBLIC_DOMAIN}/${key}`
    : key;

  return { url, key };
}

/**
 * Upload from a File object (browser upload)
 */
export async function uploadFromFile(
  file: File,
  folder: string = "uploads"
): Promise<{ url: string; key: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

  return uploadFile({
    key,
    body: buffer,
    contentType: file.type,
    metadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });
}

// ============== PRESIGNED URLS ==============

/**
 * Generate a presigned URL for uploading
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  // If public domain is set and file is in public folder, return public URL
  if (R2_PUBLIC_DOMAIN && key.startsWith("public/")) {
    return `${R2_PUBLIC_DOMAIN}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

// ============== FILE OPERATIONS ==============

/**
 * Download a file from R2
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);
  const stream = response.Body as NodeJS.ReadableStream;
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  
  return Buffer.concat(chunks);
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  prefix: string,
  maxKeys: number = 1000
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await r2Client.send(command);
  
  return (response.Contents || []).map((item) => ({
    key: item.Key!,
    size: item.Size || 0,
    lastModified: item.LastModified || new Date(),
  }));
}

// ============== HELPERS ==============

/**
 * Generate a unique key for uploads
 */
export function generateUploadKey(
  folder: string,
  filename: string,
  userId?: string
): string {
  const ext = filename.split(".").pop() || "";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const userPrefix = userId ? `${userId}/` : "";
  
  return `${folder}/${userPrefix}${timestamp}-${random}.${ext}`;
}

/**
 * Get file metadata
 */
export async function getFileMetadata(key: string): Promise<{
  contentType: string;
  contentLength: number;
  lastModified: Date;
  metadata: Record<string, string>;
} | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    const response = await r2Client.send(command);
    
    return {
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      metadata: response.Metadata || {},
    };
  } catch {
    return null;
  }
}

// ============== IMPORT FILE HANDLING ==============

/**
 * Upload an import file (RIS, BibTeX, etc.)
 */
export async function uploadImportFile(
  file: Buffer | Uint8Array,
  filename: string,
  projectId: string,
  userId: string
): Promise<{ url: string; key: string }> {
  const ext = filename.split(".").pop() || "txt";
  const key = `imports/${projectId}/${userId}/${Date.now()}-${filename}`;

  return uploadFile({
    key,
    body: file,
    contentType: getContentType(ext),
    metadata: {
      originalName: filename,
      projectId,
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });
}

/**
 * Get content type from file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ris: "application/x-research-info-systems",
    bib: "application/x-bibtex",
    bibtex: "application/x-bibtex",
    csv: "text/csv",
    xml: "application/xml",
    nbib: "text/plain",
    txt: "text/plain",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };

  return types[ext.toLowerCase()] || "application/octet-stream";
}

