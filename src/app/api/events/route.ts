import { auth } from "@/lib/auth";

// SSE endpoint for real-time updates
export async function GET(request: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Helper to send SSE events
  const sendEvent = async (type: string, data: unknown) => {
    const event = `data: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`;
    await writer.write(encoder.encode(event));
  };

  // Send initial connection confirmation
  sendEvent("connection", { 
    status: "connected", 
    userId: session.user.id,
    projectId 
  });

  // Heartbeat to keep connection alive
  const heartbeatInterval = setInterval(async () => {
    try {
      await sendEvent("heartbeat", { timestamp: Date.now() });
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    clearInterval(heartbeatInterval);
    writer.close().catch(() => {});
  });

  // In a real implementation, you would:
  // 1. Subscribe to a Redis pub/sub channel for this user/project
  // 2. Listen for events and forward them to the client
  // 3. Unsubscribe when the connection closes
  
  // To publish events from other parts of the app, import from:
  // import { publishImportProgress, publishScreeningConflict } from "@/lib/events/publisher";

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering in nginx
    },
  });
}
