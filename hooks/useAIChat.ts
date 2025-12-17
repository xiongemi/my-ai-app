'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useMemo, useCallback } from 'react';
import { useApiKeys, useBilling, Message } from '@/components/AISettingsPanel';

interface UseAIChatOptions {
  /** API endpoint to call */
  endpoint: string;
  /** Extra body parameters to include in requests */
  extraBody?: Record<string, unknown>;
}

export function useAIChat({ endpoint, extraBody = {} }: UseAIChatOptions) {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [inputValue, setInputValue] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [nonStreamingMessages, setNonStreamingMessages] = useState<Message[]>(
    [],
  );
  const [isNonStreamingLoading, setIsNonStreamingLoading] = useState(false);

  const apiKeys = useApiKeys();
  const { billingData, refetch: refetchBilling } = useBilling();

  // Create a custom transport to inject provider and apiKey (for streaming)
  const transport = useMemo(
    () =>
      ({
        sendMessages: async ({
          messages,
          abortSignal,
        }: {
          messages: Array<{
            role: string;
            parts: Array<{ type: string; text?: string }>;
          }>;
          abortSignal?: AbortSignal;
        }) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messages.map((m) => ({
                role: m.role,
                content: m.parts?.find((p) => p.type === 'text')?.text || '',
              })),
              provider: selectedProvider,
              apiKey: apiKeys[selectedProvider],
              stream: true,
              ...extraBody,
            }),
            signal: abortSignal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response.body!;
        },
        reconnectToStream: async () => {
          return undefined;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    [selectedProvider, apiKeys, endpoint, extraBody],
  );

  const {
    messages: streamingMessages,
    status,
    sendMessage,
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
          ...extraBody,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

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
        await sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: inputValue }],
        });
        setInputValue('');
      } else {
        await handleNonStreamingSubmit();
      }
    },
    [inputValue, isLoading, useStreaming, sendMessage, handleNonStreamingSubmit],
  );

  // Use appropriate messages based on mode
  const messages = useStreaming ? streamingMessages : nonStreamingMessages;

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

    // Handlers
    handleSubmit,
  };
}

