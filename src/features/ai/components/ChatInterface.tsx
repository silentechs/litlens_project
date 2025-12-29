"use client";

import { Send, User as UserIcon, Bot, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
}

interface ChatInterfaceProps {
    projectId: string;
    initialMessages?: Message[];
    className?: string;
}

export function ChatInterface({ projectId, initialMessages = [], className }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: content.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch(`/api/projects/${projectId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = "";

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: "",
            };
            setMessages(prev => [...prev, assistantMessage]);

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    assistantContent += chunk;

                    setMessages(prev =>
                        prev.map(m =>
                            m.id === assistantMessage.id
                                ? { ...m, content: assistantContent }
                                : m
                        )
                    );
                }
            }
        } catch (error) {
            console.error("[ChatInterface] Error:", error);
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, projectId, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <div className={cn("flex flex-col h-[calc(100vh-14rem)]", className)}>
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 pb-6">
                    {messages.filter(m => m.role !== "system").length === 0 && (
                        <div className="text-center text-muted-foreground mt-10">
                            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium">Ask AI about your studies</h3>
                            <p className="text-sm">
                                I can read the full text of included papers and answer your questions.
                            </p>
                        </div>
                    )}

                    {messages.filter(m => m.role !== "system").map((m) => (
                        <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {m.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="w-5 h-5 text-primary" />
                                </div>
                            )}

                            <div className={`max-w-[90%] rounded-lg p-4 ${m.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/50 border'
                                }`}>
                                <div className="prose prose-sm dark:prose-invert break-words">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            </div>

                            {m.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <UserIcon className="w-5 h-5 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <div className="bg-muted/50 border rounded-lg p-3 flex items-center">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="pt-4 mt-2 border-t">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question..."
                        className="flex-1"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}

