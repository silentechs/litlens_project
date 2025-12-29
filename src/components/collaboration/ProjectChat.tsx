"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Reply, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatMessages, useSendChatMessageOptimistic } from "@/features/collaboration/api/queries";

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: Date;
    replyToId?: string;
    replyToContent?: string;
}

interface ProjectChatProps {
    projectId: string;
    currentUser: { id: string; name: string };
    className?: string;
}

/**
 * Real-time project chat component
 */
export function ProjectChat({ projectId, currentUser, className }: ProjectChatProps) {
    const [input, setInput] = useState("");
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch messages
    const { data: messages = [], isLoading } = useChatMessages(projectId);
    
    // Send message mutation
    const sendMessage = useSendChatMessageOptimistic(projectId, currentUser);

    // Scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const handleSend = async () => {
        if (!input.trim() || sendMessage.isPending) return;

        const content = input.trim();
        setInput("");
        setReplyTo(null);

        try {
            await sendMessage.mutateAsync({
                content,
                replyToId: replyTo?.id,
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(content); // Restore on error
        } finally {
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-paper border border-border", className)}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Project Chat</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="text-center text-muted font-serif italic py-8">
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-muted font-serif italic py-8">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.userId === currentUser.id}
                            onReply={() => {
                                setReplyTo(msg);
                                inputRef.current?.focus();
                            }}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply indicator */}
            {replyTo && (
                <div className="px-4 py-2 bg-muted/10 border-t border-border flex items-center justify-between">
                    <div className="text-sm">
                        <span className="text-muted">Replying to </span>
                        <span className="font-medium">{replyTo.userName}</span>
                        <span className="text-muted ml-2 truncate max-w-[200px] inline-block align-bottom">
                            {replyTo.content.slice(0, 50)}...
                        </span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-muted hover:text-ink">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="resize-none min-h-[44px] max-h-[120px]"
                        rows={1}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || sendMessage.isPending}
                        className="flex-shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    onReply: () => void;
}

function MessageBubble({ message, isOwn, onReply }: MessageBubbleProps) {
    return (
        <div className={cn("group flex", isOwn ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[80%] rounded-lg p-3",
                isOwn
                    ? "bg-ink text-paper rounded-br-none"
                    : "bg-white border border-border rounded-bl-none"
            )}>
                {!isOwn && (
                    <p className="text-xs font-medium mb-1">{message.userName}</p>
                )}
                {message.replyToContent && (
                    <div className={cn(
                        "text-xs mb-2 p-2 rounded",
                        isOwn ? "bg-white/10" : "bg-muted/10"
                    )}>
                        <Reply className="w-3 h-3 inline mr-1" />
                        {message.replyToContent}
                    </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className="flex items-center justify-between mt-1">
                    <span className={cn(
                        "text-[10px]",
                        isOwn ? "text-paper/60" : "text-muted"
                    )}>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                        })}
                    </span>
                    <button
                        onClick={onReply}
                        className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity text-xs",
                            isOwn ? "text-paper/60 hover:text-paper" : "text-muted hover:text-ink"
                        )}
                    >
                        Reply
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProjectChat;
