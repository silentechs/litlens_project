"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Send,
    Sparkles,
    User,
    Loader2,
    FileText,
    Search,
    BarChart3,
    PenTool,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ============== TYPES ==============

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    actions?: AssistantAction[];
}

interface AssistantAction {
    type: "search" | "analyze" | "write" | "export";
    label: string;
    data?: Record<string, unknown>;
}

interface AIAssistantProps {
    projectId?: string;
    context?: {
        currentPage?: string;
        selectedStudies?: string[];
        activeSection?: string;
    };
    onAction?: (action: AssistantAction) => void;
    className?: string;
}

// ============== SUGGESTED PROMPTS ==============

const SUGGESTED_PROMPTS = [
    { icon: Search, text: "Summarize the included studies" },
    { icon: BarChart3, text: "What are the main findings?" },
    { icon: FileText, text: "Help me write the methods section" },
    { icon: PenTool, text: "Identify research gaps" },
];

// ============== MAIN COMPONENT ==============

export function AIAssistant({
    projectId,
    context,
    onAction,
    className,
}: AIAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/ai/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: content,
                    projectId,
                    context,
                    history: messages.slice(-10), // Last 10 messages for context
                }),
            });

            if (!response.ok) throw new Error("Failed to get response");

            const data = await response.json();

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.response,
                timestamp: new Date(),
                actions: data.actions,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: "I apologize, but I encountered an error. Please try again.",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }, [isLoading, projectId, context, messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div className={cn(
            "flex flex-col h-full bg-ink text-paper",
            className
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-intel-blue" />
                <span className="font-mono text-xs uppercase tracking-widest">Research Assistant</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <EmptyState onSelectPrompt={sendMessage} />
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            onAction={onAction}
                        />
                    ))
                )}

                {isLoading && (
                    <div className="flex items-center gap-2 text-paper/60">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-serif italic">Thinking...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10">
                <div className="relative">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything about your research..."
                        className="min-h-[44px] max-h-[120px] resize-none bg-white/5 border-white/20 text-paper placeholder:text-paper/40 pr-12"
                        rows={1}
                    />
                    <Button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                        size="sm"
                        className="absolute right-2 bottom-2 h-8 w-8 p-0 bg-intel-blue hover:bg-intel-blue/80"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ============== SUB-COMPONENTS ==============

function EmptyState({ onSelectPrompt }: { onSelectPrompt: (text: string) => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="p-4 bg-white/5 rounded-full">
                <Sparkles className="w-8 h-8 text-intel-blue" />
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-serif">Research Assistant</h3>
                <p className="text-sm text-paper/60 max-w-xs">
                    I can help you analyze studies, write sections, and find research gaps
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                        key={i}
                        onClick={() => onSelectPrompt(prompt.text)}
                        className="flex items-center gap-2 p-3 text-left text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm transition-colors"
                    >
                        <prompt.icon className="w-4 h-4 text-intel-blue flex-shrink-0" />
                        <span className="line-clamp-2">{prompt.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

interface MessageBubbleProps {
    message: Message;
    onAction?: (action: AssistantAction) => void;
}

function MessageBubble({ message, onAction }: MessageBubbleProps) {
    const isUser = message.role === "user";

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[85%] rounded-lg p-3",
                isUser
                    ? "bg-intel-blue text-white"
                    : "bg-white/10"
            )}>
                {!isUser && (
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-intel-blue" />
                        <span className="text-xs font-mono text-paper/60">Assistant</span>
                    </div>
                )}

                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
                        {message.actions.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => onAction?.(action)}
                                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-sm transition-colors"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AIAssistant;
