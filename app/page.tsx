'use client';

import { Code } from 'lucide-react';
import { AISettingsPanel, providers } from '@/components/AISettingsPanel';
import { useAIChat } from '@/hooks/useAIChat';

export default function Home() {
  const {
    selectedProvider,
    setSelectedProvider,
    inputValue,
    setInputValue,
    useStreaming,
    setUseStreaming,
    isLoading,
    messages,
    handleSubmit,
  } = useAIChat({ endpoint: '/api/codereview' });

  const currentProvider = providers.find((p) => p.id === selectedProvider);

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
            className="flex h-12 w-fit items-center justify-center gap-2 rounded-md bg-blue-600 px-6 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Code size={16} />
            {isLoading ? 'Reviewing...' : 'Review Code'}
          </button>
        </div>
      </form>

      <div className="flex flex-col-reverse w-full mt-8 gap-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className="whitespace-pre-wrap p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between mb-2">
              <strong className="text-zinc-900 dark:text-zinc-100">
                {m.role === 'user' ? 'You' : currentProvider?.name || 'AI'}
              </strong>
              {/* Show usage for non-streaming messages */}
              {'usage' in m && m.usage && (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {m.usage.promptTokens} prompt + {m.usage.completionTokens}{' '}
                  completion = {m.usage.totalTokens} tokens
                </span>
              )}
            </div>
            <span className="text-zinc-700 dark:text-zinc-300">
              {/* Handle both streaming (parts) and non-streaming (content) formats */}
              {'parts' in m && m.parts
                ? m.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i}>{part.text}</span>
                    ) : null,
                  )
                : 'content' in m
                  ? m.content
                  : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
