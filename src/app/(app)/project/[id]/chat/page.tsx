
import { use } from "react";
import { ChatInterface } from "@/features/ai/components/ChatInterface";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function ChatPage({ params }: PageProps) {
    const { id } = use(params);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ask AI</h2>
                    <p className="text-muted-foreground">
                        Evidence Chat with your included studies
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tip: attach full-text PDFs in <span className="font-medium">Screening</span> to enable evidence excerpts.
                    </p>
                </div>
            </div>

            <div className="flex-1 bg-card border rounded-xl p-6 shadow-sm">
                <ChatInterface projectId={id} />
            </div>
        </div>
    );
}
