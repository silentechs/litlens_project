"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Send, Reply, X, Edit2, Trash2, Paperclip, Smile, Check, CheckCheck, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  useChatMessages, 
  useSendChatMessageOptimistic,
  useEditChatMessage,
  useDeleteChatMessage,
  useUploadChatAttachment,
  useAddReaction,
  useRemoveReaction,
  useMarkMessageRead,
  type ChatMessage,
} from "@/features/collaboration/api/queries";

interface EnhancedProjectChatProps {
    projectId: string;
    currentUser: { id: string; name: string };
    className?: string;
}

const EMOJI_QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"];

/**
 * Enhanced real-time project chat with:
 * - Message editing/deletion
 * - File attachments  
 * - Emoji reactions
 * - @mentions
 * - Read receipts
 */
export function EnhancedProjectChat({ projectId, currentUser, className }: EnhancedProjectChatProps) {
    const [input, setInput] = useState("");
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: messages = [], isLoading } = useChatMessages(projectId);
    const sendMessage = useSendChatMessageOptimistic(projectId, currentUser);
    const uploadFile = useUploadChatAttachment(projectId);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Parse @mentions from input
    const mentions = useMemo(() => {
        const regex = /@(\w+)/g;
        const matches = [...input.matchAll(regex)];
        return matches.map(m => m[1]);
    }, [input]);

    // Get mentioned users (would need to fetch team members)
    const getMentionSuggestions = useCallback(() => {
        // TODO: Fetch project members and filter by mentionSearch
        return [
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" },
            { id: "3", name: "Charlie" },
        ].filter(u => 
            mentionSearch && u.name.toLowerCase().includes(mentionSearch.toLowerCase())
        );
    }, [mentionSearch]);

    const handleSend = async () => {
        if (!input.trim() || sendMessage.isPending) return;

        const content = input.trim();
        const currentReplyTo = replyTo?.id;
        
        console.log('[EnhancedProjectChat] Sending message:', { content, replyToId: currentReplyTo, projectId });
        
        setInput("");
        setReplyTo(null);
        setSelectedFile(null);

        try {
            // For now, just send the message without file attachments
            // TODO: Implement file upload flow
            const result = await sendMessage.mutateAsync({
                content,
                replyToId: currentReplyTo,
            });
            console.log('[EnhancedProjectChat] Message sent successfully:', result);
        } catch (error) {
            console.error("[EnhancedProjectChat] Failed to send message:", error);
            setInput(content);
            if (currentReplyTo) {
                // Restore reply state on error
                const msg = messages.find(m => m.id === currentReplyTo);
                if (msg) setReplyTo(msg);
            }
        } finally {
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }

        // Handle @mention autocomplete
        if (e.key === "ArrowDown" && mentionSearch) {
            e.preventDefault();
            setMentionIndex(i => Math.min(i + 1, getMentionSuggestions().length - 1));
        }
        if (e.key === "ArrowUp" && mentionSearch) {
            e.preventDefault();
            setMentionIndex(i => Math.max(i - 1, 0));
        }
        if (e.key === "Enter" && mentionSearch) {
            const suggestions = getMentionSuggestions();
            if (suggestions[mentionIndex]) {
                e.preventDefault();
                // Insert mention
                const lastAtIndex = input.lastIndexOf("@");
                const before = input.slice(0, lastAtIndex);
                const after = input.slice(lastAtIndex + mentionSearch.length + 1);
                setInput(`${before}@${suggestions[mentionIndex].name} ${after}`);
                setMentionSearch("");
                setMentionIndex(0);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const renderMentionSuggestions = () => {
        if (!mentionSearch) return null;

        const suggestions = getMentionSuggestions();
        if (suggestions.length === 0) return null;

        return (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-border rounded-lg shadow-lg py-1 w-48">
                {suggestions.map((user, idx) => (
                    <button
                        key={user.id}
                        className={cn(
                            "w-full px-3 py-2 text-left text-sm hover:bg-muted/20 transition-colors",
                            idx === mentionIndex && "bg-muted/30"
                        )}
                        onClick={() => {
                            const lastAtIndex = input.lastIndexOf("@");
                            const before = input.slice(0, lastAtIndex);
                            const after = input.slice(lastAtIndex + mentionSearch.length + 1);
                            setInput(`${before}@${user.name} ${after}`);
                            setMentionSearch("");
                            setMentionIndex(0);
                        }}
                    >
                        @{user.name}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className={cn("flex flex-col h-full bg-paper border border-border", className)}>
            <div className="px-4 py-3 border-b border-border">
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Project Chat</h3>
            </div>

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
                        <EnhancedMessageBubble
                            key={msg.id}
                            message={msg}
                            projectId={projectId}
                            currentUser={currentUser}
                            isOwn={msg.userId === currentUser.id}
                            onReply={() => {
                                setReplyTo(msg);
                                inputRef.current?.focus();
                            }}
                            onEdit={() => {
                                setEditingMessage(msg);
                                setInput(msg.content);
                                inputRef.current?.focus();
                            }}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

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

            {selectedFile && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Paperclip className="w-4 h-4 text-blue-600" />
                        <span>{selectedFile.name}</span>
                        <span className="text-muted">
                            ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-muted hover:text-ink">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="p-4 border-t border-border relative">
                {renderMentionSuggestions()}
                
                <div className="flex gap-2">
                    <div className="flex gap-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0"
                        >
                            <Paperclip className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            // Track @mentions
                            const lastWord = e.target.value.split(/\s/).pop() || "";
                            if (lastWord.startsWith("@")) {
                                setMentionSearch(lastWord.slice(1));
                            } else {
                                setMentionSearch("");
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... (@mention users)"
                        className="resize-none min-h-[44px] max-h-[120px]"
                        rows={1}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || sendMessage.isPending || uploadFile.isPending}
                        className="flex-shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface EnhancedMessageBubbleProps {
    message: ChatMessage;
    projectId: string;
    currentUser: { id: string; name: string };
    isOwn: boolean;
    onReply: () => void;
    onEdit: () => void;
}

function EnhancedMessageBubble({ 
    message, 
    projectId, 
    currentUser,
    isOwn, 
    onReply, 
    onEdit 
}: EnhancedMessageBubbleProps) {
    const [showActions, setShowActions] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    
    const deleteMessage = useDeleteChatMessage(projectId, message.id);
    const addReaction = useAddReaction(projectId, message.id);
    const removeReaction = useRemoveReaction(projectId, message.id);
    const markRead = useMarkMessageRead(projectId, message.id);

    // Mark as read when message appears
    useEffect(() => {
        if (!isOwn && !message.isDeleted) {
            markRead.mutate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message.id, isOwn]);

    const handleReaction = async (emoji: string) => {
        // Check if user already reacted with this emoji
        const userReacted = message.reactions?.[emoji]?.some(r => r.userId === currentUser.id);
        
        if (userReacted) {
            await removeReaction.mutateAsync(emoji);
        } else {
            await addReaction.mutateAsync({ emoji });
        }
        setShowReactions(false);
    };

    const handleDelete = async () => {
        if (confirm("Delete this message?")) {
            await deleteMessage.mutateAsync();
        }
    };

    // Parse @mentions in content
    const renderContent = (content: string) => {
        const parts = content.split(/(@\w+)/g);
        return parts.map((part, idx) => {
            if (part.startsWith("@")) {
                return (
                    <span key={idx} className="text-blue-600 font-medium">
                        {part}
                    </span>
                );
            }
            return <span key={idx}>{part}</span>;
        });
    };

    if (message.isDeleted) {
        return (
            <div className="flex justify-center">
                <div className="text-muted italic text-sm">Message deleted</div>
            </div>
        );
    }

    return (
        <div 
            className={cn("group flex", isOwn ? "justify-end" : "justify-start")}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className={cn(
                "max-w-[80%] rounded-lg p-3 relative",
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
                
                <p className="text-sm whitespace-pre-wrap">{renderContent(message.content)}</p>

                {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {message.attachments.map((att) => (
                            <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs underline"
                            >
                                <Paperclip className="w-3 h-3" />
                                {att.fileName}
                            </a>
                        ))}
                    </div>
                )}

                {/* Reactions */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(message.reactions).map(([emoji, users]) => (
                            <button
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                className={cn(
                                    "px-2 py-0.5 rounded-full text-xs flex items-center gap-1",
                                    users.some(u => u.userId === currentUser.id)
                                        ? "bg-blue-100 border border-blue-300"
                                        : "bg-muted/20 border border-border"
                                )}
                                title={users.map(u => u.userName).join(", ")}
                            >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{users.length}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between mt-1 gap-2">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-[10px]",
                            isOwn ? "text-paper/60" : "text-muted"
                        )}>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                            {message.editedAt && " (edited)"}
                        </span>
                        
                        {/* Read receipts for own messages */}
                        {isOwn && message.readReceipts && message.readReceipts.length > 0 && (
                            <span 
                                className="text-blue-400"
                                title={`Read by: ${message.readReceipts.map(r => r.userName).join(", ")}`}
                            >
                                <CheckCheck className="w-3 h-3" />
                            </span>
                        )}
                    </div>

                    {/* Action buttons */}
                    {showActions && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowReactions(!showReactions)}
                                className={cn(
                                    "text-xs p-1 rounded transition-colors",
                                    isOwn ? "text-paper/60 hover:text-paper" : "text-muted hover:text-ink"
                                )}
                            >
                                <Smile className="w-3 h-3" />
                            </button>
                            <button
                                onClick={onReply}
                                className={cn(
                                    "text-xs p-1 rounded transition-colors",
                                    isOwn ? "text-paper/60 hover:text-paper" : "text-muted hover:text-ink"
                                )}
                            >
                                <Reply className="w-3 h-3" />
                            </button>
                            {isOwn && (
                                <>
                                    <button
                                        onClick={onEdit}
                                        className="text-xs p-1 rounded text-paper/60 hover:text-paper transition-colors"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="text-xs p-1 rounded text-paper/60 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Quick emoji reactions */}
                {showReactions && (
                    <div className="absolute -bottom-8 left-0 bg-white border border-border rounded-lg shadow-lg p-1 flex gap-1 z-10">
                        {EMOJI_QUICK_REACTIONS.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                className="hover:bg-muted/20 p-1 rounded transition-colors"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default EnhancedProjectChat;

