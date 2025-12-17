'use client';

import { useState, useCallback } from 'react';
import { MessageCircle, Send, Sparkles, AlertCircle, X } from 'lucide-react';
import { AISettingsPanel, providers } from '@/components/AISettingsPanel';
import { useAIChat } from '@/hooks/useAIChat';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

export default function ChatPage() {
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful AI assistant.',
  );
  const [showSettings, setShowSettings] = useState(false);
  const [enableTools, setEnableTools] = useState(false);

  // Use useCallback so the function reference is stable
  const getExtraBody = useCallback(
    () => ({ systemPrompt, enableTools }),
    [systemPrompt, enableTools],
  );

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
  } = useAIChat({
    endpoint: '/api/chat',
    extraBody: getExtraBody,
  });

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="w-full max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <h1 className="flex items-center gap-3 text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          <MessageCircle size={32} />
          AI Chat
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Chat with AI using a custom system prompt.
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

          {/* Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white w-fit"
          >
            <Sparkles size={14} />
            {showSettings ? 'Hide' : 'Show'} Chat Settings
          </button>

          {/* Collapsible Settings */}
          {showSettings && (
            <div className="flex flex-col gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              {/* System Prompt */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter a custom system prompt..."
                  rows={3}
                  className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 resize-none"
                />
              </div>

              {/* Enable Tools Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTools}
                  onChange={(e) => setEnableTools(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Enable file reading tools
                </span>
              </label>
            </div>
          )}

          {/* Message Input */}
          <div className="flex gap-2 max-w-md">
            <input
              className="flex-1 p-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
              value={inputValue}
              placeholder="Type your message..."
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
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
            className={`whitespace-pre-wrap p-4 rounded-lg border ${
              m.role === 'user'
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
            }`}
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
            <div className="text-zinc-700 dark:text-zinc-300">
              {/* Handle both streaming (parts) and non-streaming (content) formats */}
              {'parts' in m && m.parts ? (
                m.parts.map((part, i) =>
                  part.type === 'text' ? (
                    <MarkdownRenderer key={i} content={part.text} />
                  ) : null,
                )
              ) : 'content' in m && m.content ? (
                <MarkdownRenderer content={m.content} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
