import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile, getUploadUrl, generateUploadKey } from "@/lib/r2";
import {
  handleApiError,
  UnauthorizedError,
  ValidationError,
  success,
  created,
} from "@/lib/api";

// POST /api/upload - Upload a file directly
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      throw new ValidationError("No file provided");
    }

    // Validate file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File size exceeds 50MB limit");
    }

    // Generate unique key
    const key = generateUploadKey(folder, file.name, session.user.id);

    // Upload file
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile({
      key,
      body: buffer,
      contentType: file.type,
      metadata: {
        originalName: file.name,
        userId: session.user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    return created({
      key: result.key,
      url: result.url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/upload?filename=xxx&contentType=xxx - Get presigned upload URL
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get("filename");
    const contentType = searchParams.get("contentType");
    const folder = searchParams.get("folder") || "uploads";

    if (!filename || !contentType) {
      throw new ValidationError("filename and contentType are required");
    }

    // Generate unique key
    const key = generateUploadKey(folder, filename, session.user.id);

    // Get presigned URL
    const uploadUrl = await getUploadUrl(key, contentType, 3600);

    return success({
      uploadUrl,
      key,
      expiresIn: 3600,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

