import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, success } from "@/lib/api";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  context: z.record(z.unknown()).optional(),
  projectId: z.string().optional(),
});

// POST /api/ai/assistant - AI Research Assistant
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const body = await request.json();
        const { messages, context, projectId } = assistantRequestSchema.parse(body);

        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API key not configured");
        }

        // Extract the current message (last in array) and history (all but last)
        const currentMessage = messages[messages.length - 1]?.content || "";
        const history = messages.slice(0, -1);

        const response = await generateAIResponse(currentMessage, projectId, context, history);

        return success(response);
    } catch (error) {
        return handleApiError(error);
    }
}

interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
}

interface AssistantAction {
    type: "search" | "analyze" | "write" | "export";
    label: string;
    data?: Record<string, unknown>;
}

async function generateAIResponse(
    message: string,
    projectId?: string,
    context?: Record<string, unknown>,
    history?: ConversationMessage[]
): Promise<{ response: string; actions?: AssistantAction[] }> {
  try {
    // Build context from provided data
    let systemContext = "You are an academic research assistant helping with systematic literature reviews and research writing.";
    
    if (context?.writingContent) {
      systemContext += `\n\nCurrent document content: ${JSON.stringify(context.writingContent).substring(0, 500)}`;
    }
    
    if (context?.citations && Array.isArray(context.citations)) {
      systemContext += `\n\nAvailable citations: ${(context.citations as any[]).map((c: any) => `${c.title} (${c.year})`).join(", ")}`;
    }

    // Build conversation messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemContext,
      },
    ];

    // Add conversation history
    if (history && history.length > 0) {
      history.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const response = completion.choices[0].message.content || "I apologize, but I couldn't generate a response.";

    // Analyze the user's message to suggest relevant actions
    const actions: AssistantAction[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("improve") || lowerMessage.includes("revise")) {
      actions.push({ type: "write", label: "Improve selected text" });
    }

    if (lowerMessage.includes("expand") || lowerMessage.includes("elaborate")) {
      actions.push({ type: "write", label: "Expand section" });
    }

    if (lowerMessage.includes("summarize") || lowerMessage.includes("condense")) {
      actions.push({ type: "write", label: "Summarize text" });
    }

    if (lowerMessage.includes("cite") || lowerMessage.includes("citation")) {
      actions.push({ type: "search", label: "Find relevant citations" });
    }

    return { response, actions: actions.length > 0 ? actions : undefined };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    
    // Fallback to helpful error message
    return {
      response: "I'm having trouble connecting to the AI service. Please check that your OpenAI API key is configured correctly in your environment variables (.env.local).",
    };
  }
}
