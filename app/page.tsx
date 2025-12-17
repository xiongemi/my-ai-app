'use client';

import { useState } from 'react';
import { Code, GitPullRequest, AlertCircle, X } from 'lucide-react';
import { AISettingsPanel, providers } from '@/components/AISettingsPanel';
import { useAIChat } from '@/hooks/useAIChat';

type InputMode = 'file' | 'pr';

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>('file');

  const {
    selectedProvider,
    setSelectedProvider,
    selectedModel,
    setSelectedModel,
    inputValue,
    setInputValue,
    useStreaming,
    setUseStreaming,
    isLoading,
    messages,
    handleSubmit,
    error,
    clearError,
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
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            useStreaming={useStreaming}
            onStreamingChange={setUseStreaming}
          />

          {/* Input Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Code size={14} />
              File Path
            </button>
            <button
              type="button"
              onClick={() => setInputMode('pr')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'pr'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <GitPullRequest size={14} />
              PR Link
            </button>
          </div>

          <input
            className="w-full max-w-md p-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
            value={inputValue}
            placeholder={
              inputMode === 'file'
                ? 'Enter file path...'
                : 'Enter GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)'
            }
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-fit items-center justify-center gap-2 rounded-md bg-blue-600 px-6 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inputMode === 'file' ? (
              <Code size={16} />
            ) : (
              <GitPullRequest size={16} />
            )}
            {isLoading ? 'Reviewing...' : 'Review Code'}
          </button>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 flex items-start gap-3">
          <AlertCircle
            size={20}
            className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error.message}
            </p>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X size={18} />
          </button>
        </div>
      )}

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
