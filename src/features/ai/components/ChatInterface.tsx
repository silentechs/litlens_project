"use client";

import { 
  Send, 
  User as UserIcon, 
  Bot, 
  FileText, 
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
  MessageSquare,
  History,
  Plus,
  MoreVertical,
  Pin,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ============== TYPES ==============

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Citation {
  workId: string;
  workTitle: string;
  authors?: string;
  year?: number;
  doi?: string;
  pageNumber?: number;
  section?: string;
  excerpt: string;
  similarity: number;
}

interface ChatMetadata {
  type: string;
  conversationId: string;
  citations: Citation[];
  confidence: number;
  evidenceQuality: 'strong' | 'moderate' | 'weak' | 'none';
  sourceCount: number;
  suggestedQuestions: string[];
}

interface Conversation {
  id: string;
  title?: string;
  messageCount: number;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
}

interface ChatInterfaceProps {
  projectId: string;
  className?: string;
  initialMessages?: Message[];
}

// ============== MAIN COMPONENT ==============

export function ChatInterface({ projectId, className, initialMessages = [] }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState<ChatMetadata | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [projectId]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/ai-chat/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Extract conversation ID from headers
      const newConvId = response.headers.get('X-Conversation-Id');
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
        loadConversations();
      }

      // Extract metadata from headers
      const metadataHeader = response.headers.get('X-Chat-Metadata');
      if (metadataHeader) {
        try {
          const decoded = JSON.parse(atob(metadataHeader));
          setCurrentMetadata({
            type: 'metadata',
            ...decoded,
          });
        } catch (e) {
          console.error('Failed to decode chat metadata:', e);
        }
      }

      // Stream the response
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
  }, [messages, projectId, conversationId, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setCurrentMetadata(null);
    setShowHistory(false);
  };

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/ai-chat/conversations/${convId}`);
      if (response.ok) {
        const { conversation } = await response.json();
        setConversationId(convId);
        if (conversation.messages) {
          setMessages(conversation.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })));
        }
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleFeedback = async (messageId: string, score: 1 | 5) => {
    try {
      await fetch(`/api/projects/${projectId}/ai-chat/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      setFeedbackGiven(prev => ({ ...prev, [messageId]: score === 5 ? 'up' : 'down' }));
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleFlag = async (messageId: string) => {
    const reason = prompt('Please describe the issue with this response:');
    if (!reason) return;
    
    try {
      await fetch(`/api/projects/${projectId}/ai-chat/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      alert('Thank you for your feedback. This response has been flagged for review.');
    } catch (error) {
      console.error('Failed to flag message:', error);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const deleteConversation = async (convId: string) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await fetch(`/api/projects/${projectId}/ai-chat/conversations/${convId}`, {
        method: 'DELETE',
      });
      loadConversations();
      if (convId === conversationId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const togglePin = async (convId: string, isPinned: boolean) => {
    try {
      await fetch(`/api/projects/${projectId}/ai-chat/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned }),
      });
      loadConversations();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  return (
    <div className={cn("flex flex-col h-[calc(100vh-14rem)]", className)}>
      {/* Header with history toggle */}
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
            {conversations.length > 0 && (
              <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs">
                {conversations.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewConversation}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>
        
        {currentMetadata && (
          <EvidenceIndicator 
            quality={currentMetadata.evidenceQuality}
            confidence={currentMetadata.confidence}
            sourceCount={currentMetadata.sourceCount}
          />
        )}
      </div>

      {/* Conversation History Sidebar */}
      {showHistory && (
        <div className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r shadow-lg z-10 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Chat History</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                    conv.id === conversationId && "bg-muted"
                  )}
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {conv.isPinned && <Pin className="w-3 h-3 text-primary" />}
                        <p className="font-medium text-sm truncate">
                          {conv.title || 'Untitled conversation'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {conv.messageCount} messages
                      </p>
                    </div>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-white rounded-md shadow-lg border p-1 z-50">
                          <DropdownMenu.Item 
                            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded"
                            onClick={(e) => { e.stopPropagation(); togglePin(conv.id, conv.isPinned); }}
                          >
                            <Pin className="w-3 h-3" />
                            {conv.isPinned ? 'Unpin' : 'Pin'}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item 
                            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded text-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversations yet
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-6 pb-6">
          {messages.filter(m => m.role !== "system").length === 0 && (
            <EmptyState onSuggestedQuestion={handleSuggestedQuestion} />
          )}

          {messages.filter(m => m.role !== "system").map((m) => (
            <div key={m.id}>
              <MessageBubble
                message={m}
                metadata={m.role === 'assistant' ? currentMetadata : undefined}
                feedbackGiven={feedbackGiven[m.id]}
                onFeedback={(score) => handleFeedback(m.id, score)}
                onFlag={() => handleFlag(m.id)}
              />
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="bg-muted/50 border rounded-lg p-3 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Analyzing your studies...</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Suggested Questions */}
      {currentMetadata?.suggestedQuestions && currentMetadata.suggestedQuestions.length > 0 && !isLoading && (
        <div className="py-3 border-t">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Suggested follow-ups
          </p>
          <div className="flex flex-wrap gap-2">
            {currentMetadata.suggestedQuestions.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleSuggestedQuestion(q)}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="pt-4 mt-2 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your included studies..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ============== SUB-COMPONENTS ==============

function EmptyState({ onSuggestedQuestion }: { onSuggestedQuestion: (q: string) => void }) {
  const suggestions = [
    "Summarize the main findings across all included studies",
    "What methods were used in the included studies?",
    "What are the key research gaps identified?",
    "Compare the outcomes across different interventions",
  ];

  return (
    <div className="text-center text-muted-foreground mt-10">
      <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <h3 className="text-lg font-medium">Ask AI about your studies</h3>
      <p className="text-sm mb-6">
        I can read the full text of included papers and answer your questions with citations.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggestions.map((s, i) => (
          <Button
            key={i}
            variant="outline"
            className="text-sm text-left justify-start h-auto py-3 px-4"
            onClick={() => onSuggestedQuestion(s)}
          >
            <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
            <span className="line-clamp-2">{s}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function EvidenceIndicator({ 
  quality, 
  confidence, 
  sourceCount 
}: { 
  quality: string; 
  confidence: number; 
  sourceCount: number;
}) {
  const configMap: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
    strong: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Strong evidence' },
    moderate: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Moderate evidence' },
    weak: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Limited evidence' },
    none: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'No evidence' },
  };

  const config = configMap[quality] || configMap.none;
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs", config.bg, config.color)}>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
      <span className="opacity-70">•</span>
      <span>{sourceCount} sources</span>
      <span className="opacity-70">•</span>
      <span>{(confidence * 100).toFixed(0)}% confident</span>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  metadata?: ChatMetadata | null;
  feedbackGiven?: 'up' | 'down';
  onFeedback: (score: 1 | 5) => void;
  onFlag: () => void;
}

function MessageBubble({ message, metadata, feedbackGiven, onFeedback, onFlag }: MessageBubbleProps) {
  const [showCitations, setShowCitations] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className={`max-w-[90%] rounded-lg ${isUser
        ? 'bg-primary text-primary-foreground p-4'
        : 'bg-muted/50 border p-4'
      }`}>
        <div className="prose prose-sm dark:prose-invert break-words">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Citations (for assistant messages) */}
        {!isUser && metadata?.citations && metadata.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="w-3 h-3" />
              {metadata.citations.length} sources
              {showCitations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {showCitations && (
              <div className="mt-2 space-y-2">
                {metadata.citations.map((citation, i) => (
                  <CitationCard key={i} citation={citation} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback (for assistant messages) */}
        {!isUser && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                feedbackGiven === 'up' && "text-green-600 bg-green-50"
              )}
              onClick={() => onFeedback(5)}
              disabled={!!feedbackGiven}
            >
              <ThumbsUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                feedbackGiven === 'down' && "text-red-600 bg-red-50"
              )}
              onClick={() => onFeedback(1)}
              disabled={!!feedbackGiven}
            >
              <ThumbsDown className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={onFlag}
            >
              <Flag className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <div className="bg-background rounded-md p-3 text-xs border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium line-clamp-1">
            [{index + 1}] {citation.workTitle}
          </p>
          <p className="text-muted-foreground">
            {citation.authors && `${citation.authors.split(',')[0]} et al.`}
            {citation.year && ` (${citation.year})`}
            {citation.pageNumber && ` • p.${citation.pageNumber}`}
            {citation.section && ` • ${citation.section}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px]",
            citation.similarity >= 0.7 ? "bg-green-100 text-green-700" :
            citation.similarity >= 0.5 ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-700"
          )}>
            {(citation.similarity * 100).toFixed(0)}%
          </span>
          {citation.doi && (
            <a
              href={`https://doi.org/${citation.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
      <p className="mt-2 text-muted-foreground italic line-clamp-2">
        &quot;{citation.excerpt}&quot;
      </p>
    </div>
  );
}

export default ChatInterface;
