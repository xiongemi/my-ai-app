"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useMemo } from "react";
import { Code } from "lucide-react";
import {
  AISettingsPanel,
  useApiKeys,
  useBilling,
  providers,
  Message,
} from "@/components/AISettingsPanel";

export default function Home() {
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [inputValue, setInputValue] = useState("");
  const [useStreaming, setUseStreaming] = useState(true);
  const [nonStreamingMessages, setNonStreamingMessages] = useState<Message[]>(
    [],
  );
  const [isNonStreamingLoading, setIsNonStreamingLoading] = useState(false);

  const apiKeys = useApiKeys();
  const { billingData, refetch: refetchBilling } = useBilling();

  // Create a custom transport to inject provider and apiKey (for streaming)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          const response = await fetch("/api/codereview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: messages.map((m) => ({
                role: m.role,
                content: m.parts?.find((p) => p.type === "text")?.text || "",
              })),
              provider: selectedProvider,
              apiKey: apiKeys[selectedProvider],
              stream: true,
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
    [selectedProvider, apiKeys],
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

  const isStreamingLoading = status === "streaming" || status === "submitted";
  const isLoading = useStreaming ? isStreamingLoading : isNonStreamingLoading;

  // Non-streaming submit handler
  const handleNonStreamingSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
    };

    setNonStreamingMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsNonStreamingLoading(true);

    try {
      const response = await fetch("/api/codereview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...nonStreamingMessages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text,
        usage: data.usage,
      };

      setNonStreamingMessages((prev) => [...prev, assistantMessage]);
      refetchBilling();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsNonStreamingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (useStreaming) {
      await sendMessage({
        role: "user",
        parts: [{ type: "text", text: inputValue }],
      });
      setInputValue("");
    } else {
      await handleNonStreamingSubmit();
    }
  };

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // Use appropriate messages based on mode
  const displayMessages = useStreaming
    ? streamingMessages
    : nonStreamingMessages;

  return (
    <div className="w-full max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          AI Code Reviewer
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Enter the path to a file to have it reviewed by an AI agent.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full mt-8">
        <div className="flex flex-col gap-4">
          {/* Shared AI Settings Panel */}
          <AISettingsPanel
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            useStreaming={useStreaming}
            onStreamingChange={setUseStreaming}
          />

          <input
            className="w-full max-w-md p-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
            value={inputValue}
            placeholder="Enter file path..."
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Code size={16} />
            {isLoading ? "Reviewing..." : "Review Code"}
          </button>
        </div>
      </form>

      <div className="flex flex-col-reverse w-full mt-8 gap-4">
        {displayMessages.map((m) => (
          <div
            key={m.id}
            className="whitespace-pre-wrap p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between mb-2">
              <strong className="text-zinc-900 dark:text-zinc-100">
                {m.role === "user" ? "You" : currentProvider?.name || "AI"}
              </strong>
              {/* Show usage for non-streaming messages */}
              {"usage" in m && m.usage && (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {m.usage.promptTokens} prompt + {m.usage.completionTokens}{" "}
                  completion = {m.usage.totalTokens} tokens
                </span>
              )}
            </div>
            <span className="text-zinc-700 dark:text-zinc-300">
              {/* Handle both streaming (parts) and non-streaming (content) formats */}
              {"parts" in m && m.parts
                ? m.parts.map((part, i) =>
                    part.type === "text" ? (
                      <span key={i}>{part.text}</span>
                    ) : null,
                  )
                : "content" in m
                  ? m.content
                  : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
