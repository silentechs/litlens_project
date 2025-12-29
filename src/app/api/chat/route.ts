
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { handleApiError } from "@/lib/api";

// Fallback chat route for /api/chat calls
// This catches cases where projectId might be missing or default useChat is triggered
export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        console.warn("[GlobalChat] /api/chat called fallback. Check client configuration.");

        const result = streamText({
            model: openai("gpt-4o-mini"),
            system: "You are a helpful research assistant. Note: I am running in fallback mode and do not have access to specific project documents context.",
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        return handleApiError(error);
    }
}
