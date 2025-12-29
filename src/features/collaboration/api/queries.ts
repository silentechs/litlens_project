import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ============== TYPES ==============

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  replyToId?: string;
  replyToContent?: string;
  replyToUserName?: string;
  isDeleted?: boolean;
  editedAt?: Date;
  attachments?: ChatAttachment[];
  reactions?: Record<string, ChatReactionUser[]>;
  readReceipts?: ChatReadReceipt[];
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface ChatReactionUser {
  userId: string;
  userName: string;
  userImage?: string | null;
}

export interface ChatReadReceipt {
  userId: string;
  userName: string;
  userImage?: string | null;
  readAt: Date;
}

export interface SendChatMessageInput {
  content: string;
  replyToId?: string;
  attachmentKeys?: string[];
}

export interface EditChatMessageInput {
  content: string;
}

export interface AddReactionInput {
  emoji: string;
}

// ============== QUERY KEYS ==============

export const chatKeys = {
  all: ["chat"] as const,
  messages: (projectId: string) => ["chat-messages", projectId] as const,
  reactions: (messageId: string) => ["chat-reactions", messageId] as const,
  readReceipts: (messageId: string) => ["chat-read-receipts", messageId] as const,
};

// ============== QUERIES ==============

/**
 * Fetch chat messages for a project
 */
export function useChatMessages(projectId: string) {
  return useQuery({
    queryKey: chatKeys.messages(projectId),
    queryFn: async () => {
      const response = await api.get<ChatMessage[]>(
        `/api/projects/${projectId}/chat/messages`
      );
      return response.map((msg) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
        editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false, // Real-time updates via SSE
  });
}

/**
 * Fetch reactions for a specific message
 */
export function useMessageReactions(projectId: string, messageId: string) {
  return useQuery({
    queryKey: chatKeys.reactions(messageId),
    queryFn: async () => {
      const response = await api.get<Record<string, ChatReactionUser[]>>(
        `/api/projects/${projectId}/chat/messages/${messageId}/reactions`
      );
      return response;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch read receipts for a specific message
 */
export function useMessageReadReceipts(projectId: string, messageId: string) {
  return useQuery({
    queryKey: chatKeys.readReceipts(messageId),
    queryFn: async () => {
      const response = await api.get<ChatReadReceipt[]>(
        `/api/projects/${projectId}/chat/messages/${messageId}/read`
      );
      return response.map((r) => ({
        ...r,
        readAt: new Date(r.readAt),
      }));
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============== MUTATIONS ==============

/**
 * Send a chat message
 */
export function useSendChatMessage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendChatMessageInput) => {
      const response = await api.post<ChatMessage>(
        `/api/projects/${projectId}/chat/messages`,
        input
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.messages(projectId) 
      });
    },
  });
}

/**
 * Send with optimistic update
 */
export function useSendChatMessageOptimistic(projectId: string, currentUser: { id: string; name: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendChatMessageInput) => {
      console.log('[useSendChatMessageOptimistic] Sending to API:', { projectId, input });
      
      const response = await api.post<ChatMessage>(
        `/api/projects/${projectId}/chat/messages`,
        input
      );
      
      console.log('[useSendChatMessageOptimistic] Response:', response);
      return response;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(projectId) });

      const previousMessages = queryClient.getQueryData<ChatMessage[]>(
        chatKeys.messages(projectId)
      );

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        content: input.content,
        createdAt: new Date(),
        replyToId: input.replyToId,
      };

      queryClient.setQueryData<ChatMessage[]>(
        chatKeys.messages(projectId),
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (_err, _input, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          chatKeys.messages(projectId),
          context.previousMessages
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.messages(projectId) 
      });
    },
  });
}

/**
 * Edit a chat message
 */
export function useEditChatMessage(projectId: string, messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EditChatMessageInput) => {
      const response = await api.patch<{ id: string; content: string; editedAt: Date }>(
        `/api/projects/${projectId}/chat/messages/${messageId}`,
        input
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.messages(projectId) 
      });
    },
  });
}

/**
 * Delete a chat message
 */
export function useDeleteChatMessage(projectId: string, messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete(
        `/api/projects/${projectId}/chat/messages/${messageId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.messages(projectId) 
      });
    },
  });
}

/**
 * Upload file attachment
 */
export function useUploadChatAttachment(projectId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post<ChatAttachment & { key: string }>(
        `/api/projects/${projectId}/chat/upload`,
        formData
      );
      return response;
    },
  });
}

/**
 * Add emoji reaction to message
 */
export function useAddReaction(projectId: string, messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddReactionInput) => {
      const response = await api.post<{ emoji: string }>(
        `/api/projects/${projectId}/chat/messages/${messageId}/reactions`,
        input
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.reactions(messageId) 
      });
    },
  });
}

/**
 * Remove emoji reaction from message
 */
export function useRemoveReaction(projectId: string, messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emoji: string) => {
      await api.delete(
        `/api/projects/${projectId}/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.reactions(messageId) 
      });
    },
  });
}

/**
 * Mark message as read
 */
export function useMarkMessageRead(projectId: string, messageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/api/projects/${projectId}/chat/messages/${messageId}/read`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.readReceipts(messageId) 
      });
    },
  });
}

/**
 * Mark multiple messages as read (batch)
 */
export function useMarkMessagesRead(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { messageIds: string[] }) => {
      // Mark each message individually since we don't have a batch endpoint
      await Promise.all(
        input.messageIds.map(messageId =>
          apiClient.post(`/api/projects/${projectId}/chat/messages/${messageId}/read`)
        )
      );
    },
    onSuccess: () => {
      // Invalidate all read receipts
      queryClient.invalidateQueries({ 
        queryKey: ["chat-read-receipts"] 
      });
    },
  });
}
