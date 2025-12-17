'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState, useMemo, useCallback } from 'react';
import { useApiKeys, useBilling, Message } from '@/components/AISettingsPanel';

interface UseAIChatOptions {
  /** API endpoint to call */
  endpoint: string;
  /** Extra body parameters to include in requests (can be a function for dynamic values) */
  extraBody?: () => Record<string, unknown>;
}

export function useAIChat({ endpoint, extraBody }: UseAIChatOptions) {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [inputValue, setInputValue] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [nonStreamingMessages, setNonStreamingMessages] = useState<Message[]>(
    [],
  );
  const [isNonStreamingLoading, setIsNonStreamingLoading] = useState(false);
  const [nonStreamingError, setNonStreamingError] = useState<Error | null>(
    null,
  );

  const apiKeys = useApiKeys();
  const { billingData, refetch: refetchBilling } = useBilling();

  // Use TextStreamChatTransport with prepareSendMessagesRequest to ensure correct format
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: endpoint,
        // Use prepareSendMessagesRequest to explicitly include messages in the request body
        prepareSendMessagesRequest: ({ messages, body: requestBody }) => ({
          body: {
            messages,
            provider: selectedProvider,
            apiKey: apiKeys[selectedProvider],
            stream: true,
            ...(extraBody?.() ?? {}),
            ...requestBody,
          },
        }),
      }),
    [endpoint, selectedProvider, apiKeys, extraBody],
  );

  const {
    messages: streamingMessages,
    status,
    sendMessage,
    error: streamingError,
    clearError: clearStreamingError,
  } = useChat({
    transport,
    onFinish: () => {
      refetchBilling();
    },
  });

  const isStreamingLoading = status === 'streaming' || status === 'submitted';
  const isLoading = useStreaming ? isStreamingLoading : isNonStreamingLoading;

  // Non-streaming submit handler
  const handleNonStreamingSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setNonStreamingMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsNonStreamingLoading(true);
    setNonStreamingError(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...nonStreamingMessages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider],
          stream: false,
          ...(extraBody?.() ?? {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
        usage: data.usage,
      };

      setNonStreamingMessages((prev) => [...prev, assistantMessage]);
      refetchBilling();
    } catch (error) {
      console.error('Error:', error);
      setNonStreamingError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setIsNonStreamingLoading(false);
    }
  }, [
    inputValue,
    isLoading,
    nonStreamingMessages,
    selectedProvider,
    apiKeys,
    endpoint,
    extraBody,
    refetchBilling,
  ]);

  // Unified submit handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      if (useStreaming) {
        // Use sendMessage with text format (AI SDK 5 style)
        await sendMessage({ text: inputValue });
        setInputValue('');
      } else {
        await handleNonStreamingSubmit();
      }
    },
    [inputValue, isLoading, useStreaming, sendMessage, handleNonStreamingSubmit],
  );

  // Use appropriate messages based on mode
  const messages = useStreaming ? streamingMessages : nonStreamingMessages;

  // Use appropriate error based on mode
  const error = useStreaming ? streamingError : nonStreamingError;

  // Clear error function
  const clearError = useCallback(() => {
    if (useStreaming) {
      clearStreamingError();
    } else {
      setNonStreamingError(null);
    }
  }, [useStreaming, clearStreamingError]);

  return {
    // State
    selectedProvider,
    setSelectedProvider,
    inputValue,
    setInputValue,
    useStreaming,
    setUseStreaming,
    isLoading,
    messages,
    billingData,
    error,

    // Handlers
    handleSubmit,
    clearError,
  };
}
