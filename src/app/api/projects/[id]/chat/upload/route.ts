import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError, ValidationError } from "@/lib/api";
import { db } from "@/lib/db";
import { generateUploadKey, uploadFile, getDownloadUrl } from "@/lib/r2";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
];

// POST /api/projects/[id]/chat/upload - Upload file attachment
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Verify project membership
        const membership = await db.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: session.user.id,
                },
            },
        });

        if (!membership) {
            throw new NotFoundError("Project");
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const messageId = formData.get("messageId") as string | null;

        if (!file) {
            throw new ValidationError("No file provided");
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new ValidationError(`File type ${file.type} not allowed`);
        }

        // If messageId provided, verify it exists and belongs to user
        if (messageId) {
            const message = await db.chatMessage.findUnique({
                where: { id: messageId },
            });

            if (!message) {
                throw new NotFoundError("Message");
            }

            if (message.userId !== session.user.id) {
                throw new ValidationError("Message does not belong to you");
            }

            if (message.projectId !== projectId) {
                throw new ValidationError("Message does not belong to this project");
            }
        }

        // Upload to R2
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = generateUploadKey(
            `chat-attachments/${projectId}`,
            file.name,
            session.user.id
        );

        const { key: uploadedKey } = await uploadFile({
            key,
            body: buffer,
            contentType: file.type,
            metadata: {
                originalName: file.name,
                projectId,
                userId: session.user.id,
                uploadedAt: new Date().toISOString(),
            },
        });

        // Get download URL (presigned for 7 days)
        const url = await getDownloadUrl(uploadedKey, 7 * 24 * 60 * 60);

        // Create attachment record if message exists
        if (messageId) {
            const attachment = await db.chatAttachment.create({
                data: {
                    messageId,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    url: uploadedKey, // Store key, generate URL on demand
                },
            });

            return Response.json({
                success: true,
                data: {
                    id: attachment.id,
                    fileName: attachment.fileName,
                    fileSize: attachment.fileSize,
                    mimeType: attachment.mimeType,
                    url,
                    key: uploadedKey,
                },
            });
        }

        // Return upload info for pending message
        return Response.json({
            success: true,
            data: {
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                url,
                key: uploadedKey,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

