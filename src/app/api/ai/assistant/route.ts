import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, success } from "@/lib/api";

// POST /api/ai/assistant - AI Research Assistant
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { message, projectId, context, history } = await request.json();

        // For now, return a simulated response
        // In production, this would call OpenAI/Anthropic API
        const response = await generateAIResponse(message, projectId, context, history);

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
    // Simulated responses based on keywords
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("summarize") || lowerMessage.includes("summary")) {
        return {
            response: "Based on the included studies in your review, the main themes that emerge are:\n\n1. **Methodology**: Most studies employ randomized controlled trial designs with varying sample sizes.\n\n2. **Key Findings**: There appears to be a consistent positive effect across studies, though heterogeneity is notable.\n\n3. **Limitations**: Several studies report small sample sizes and short follow-up periods.\n\nWould you like me to elaborate on any of these points or help you write a synthesis paragraph?",
            actions: [
                { type: "write", label: "Draft synthesis paragraph" },
                { type: "analyze", label: "Show heterogeneity analysis" },
            ],
        };
    }

    if (lowerMessage.includes("gap") || lowerMessage.includes("gaps")) {
        return {
            response: "I've identified several potential research gaps in your included studies:\n\n1. **Population**: Limited research in pediatric populations and low-resource settings.\n\n2. **Outcomes**: Long-term outcomes (>12 months) are rarely reported.\n\n3. **Mechanisms**: The underlying mechanisms of effect are poorly understood.\n\n4. **Implementation**: Few studies examine real-world implementation challenges.\n\nThese gaps could form the basis of your discussion section or future research recommendations.",
            actions: [
                { type: "write", label: "Draft future research section" },
            ],
        };
    }

    if (lowerMessage.includes("methods") || lowerMessage.includes("methodology")) {
        return {
            response: "Here's a draft methods section based on your review protocol:\n\n**Search Strategy**\nWe searched [databases] from [dates] using the following terms: [terms]. Reference lists of included studies were also screened.\n\n**Eligibility Criteria**\nWe included [study types] examining [intervention/exposure] in [population]. Studies were excluded if [exclusion criteria].\n\n**Data Extraction**\nTwo reviewers independently extracted data using a standardized form. Discrepancies were resolved by consensus.\n\nShall I expand any section or help with the risk of bias assessment description?",
            actions: [
                { type: "write", label: "Expand search strategy" },
                { type: "write", label: "Add risk of bias section" },
            ],
        };
    }

    if (lowerMessage.includes("finding") || lowerMessage.includes("result")) {
        return {
            response: "Based on the data extracted from your included studies:\n\n**Primary Outcome**: The overall effect shows [direction] with [effect size/statistics].\n\n**Secondary Outcomes**: Variable results across secondary endpoints.\n\n**Subgroup Analyses**: [Key subgroup findings]\n\nI can help you visualize these findings or draft the results narrative.",
            actions: [
                { type: "analyze", label: "Generate forest plot data" },
                { type: "write", label: "Draft results section" },
            ],
        };
    }

    // Default response
    return {
        response: "I understand you're asking about: \"" + message + "\"\n\nI can help you with:\n• Summarizing and synthesizing your included studies\n• Identifying research gaps and limitations\n• Drafting methods, results, or discussion sections\n• Analyzing patterns across your data\n\nCould you provide more context about what specific aspect you'd like me to focus on?",
    };
}
