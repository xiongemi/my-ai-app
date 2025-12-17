'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useApiKeys, useBilling, Message } from '@/components/AISettingsPanel';
import { getDefaultModel } from '@/lib/models';

interface UseAIChatOptions {
  /** API endpoint to call */
  endpoint: string;
  /** Extra body parameters to include in requests (can be a function for dynamic values) */
  extraBody?: () => Record<string, unknown>;
}

export function useAIChat({ endpoint, extraBody }: UseAIChatOptions) {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    getDefaultModel('openai'),
  );

  // Reset model when provider changes
  const handleProviderChange = useCallback(
    (provider: string) => {
      const defaultModel = getDefaultModel(provider);
      setSelectedProvider(provider);
      setSelectedModel(defaultModel);
    },
    [],
  );
  const [inputValue, setInputValue] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [nonStreamingMessages, setNonStreamingMessages] = useState<Message[]>(
    [],
  );
  const [isNonStreamingLoading, setIsNonStreamingLoading] = useState(false);
  const [nonStreamingError, setNonStreamingError] = useState<Error | null>(
    null,
  );
  const [streamingErrorState, setStreamingErrorState] = useState<Error | null>(
    null,
  );

  const apiKeys = useApiKeys();
  const { billingData, refetch: refetchBilling } = useBilling();

  // Use refs to store latest values so the transport callback always reads current values
  const providerRef = useRef(selectedProvider);
  const modelRef = useRef(selectedModel);
  const apiKeysRef = useRef(apiKeys);
  const extraBodyRef = useRef(extraBody);

  // Update refs when values change
  useEffect(() => {
    providerRef.current = selectedProvider;
    modelRef.current = selectedModel;
    apiKeysRef.current = apiKeys;
    extraBodyRef.current = extraBody;
  }, [selectedProvider, selectedModel, apiKeys, extraBody]);

  // Use DefaultChatTransport with prepareSendMessagesRequest to ensure correct format
  // DefaultChatTransport works with toUIMessageStreamResponse() which properly handles errors
  const transport = useMemo(() => {
    console.log(
      `[Transport Created] Provider: ${selectedProvider}, Model: ${selectedModel}`,
    );
    
    return new DefaultChatTransport({
      api: endpoint,
      // Use prepareSendMessagesRequest to explicitly include messages in the request body
      prepareSendMessagesRequest: ({ messages, body: requestBody }) => {
        // Read current values from refs to ensure we always use the latest
        const currentProvider = providerRef.current;
        const currentModel = modelRef.current;
        const currentApiKeys = apiKeysRef.current;
        const providerApiKey = currentApiKeys[currentProvider];
        
        // Debug logging for all providers
        console.log(
          `[Frontend Streaming] Provider: ${currentProvider}, Model: ${currentModel}, API Key: ${providerApiKey ? providerApiKey.substring(0, 10) + '...' : 'NOT SET'}`,
        );
        
        return {
          body: {
            messages,
            provider: currentProvider,
            model: currentModel,
            apiKey: providerApiKey, // Only send if it exists
            stream: true,
            ...(extraBodyRef.current?.() ?? {}),
            ...requestBody,
          },
        };
      },
    });
  }, [endpoint, selectedProvider, selectedModel, apiKeys, extraBody]);

  const {
    messages: streamingMessages,
    status,
    sendMessage,
    error: useChatError,
    clearError: clearUseChatError,
  } = useChat({
    transport,
    onError: (error) => {
      console.error('Streaming error:', error);
      setStreamingErrorState(error);
    },
    onFinish: () => {
      refetchBilling();
    },
  });

  // Combine useChat error with our state error, and check status for error state
  const streamingError =
    useChatError ||
    streamingErrorState ||
    (status === 'error'
      ? new Error('An error occurred during streaming')
      : null);

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
      const requestBody = {
        messages: [...nonStreamingMessages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        provider: selectedProvider,
        model: selectedModel,
        apiKey: apiKeys[selectedProvider],
        stream: false,
        ...(extraBody?.() ?? {}),
      };
      
      // Debug logging for non-streaming requests
      console.log(
        `[Frontend Non-Streaming] Provider: ${selectedProvider}, Model: ${selectedModel}, API Key: ${apiKeys[selectedProvider] ? apiKeys[selectedProvider].substring(0, 10) + '...' : 'NOT SET'}`,
      );
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
    selectedModel,
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
        // Clear previous errors before sending new message
        setStreamingErrorState(null);
        // Use sendMessage with text format (AI SDK 5 style)
        await sendMessage({ text: inputValue });
        setInputValue('');
      } else {
        await handleNonStreamingSubmit();
      }
    },
    [
      inputValue,
      isLoading,
      useStreaming,
      sendMessage,
      handleNonStreamingSubmit,
    ],
  );

  // Use appropriate messages based on mode
  const messages = useStreaming ? streamingMessages : nonStreamingMessages;

  // Use appropriate error based on mode
  const error = useStreaming ? streamingError : nonStreamingError;

  // Clear error function
  const clearError = useCallback(() => {
    if (useStreaming) {
      clearUseChatError();
      setStreamingErrorState(null);
    } else {
      setNonStreamingError(null);
    }
  }, [useStreaming, clearUseChatError]);

  return {
    // State
    selectedProvider,
    setSelectedProvider: handleProviderChange,
    selectedModel,
    setSelectedModel,
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
