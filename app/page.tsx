'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Code,
  GitPullRequest,
  AlertCircle,
  X,
  Sparkles,
  FileText,
  Upload,
} from 'lucide-react';
import { AISettingsPanel, providers } from '@/components/AISettingsPanel';
import { useAIChat } from '@/hooks/useAIChat';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useVercelGatewayFallbackModels } from '@/components/VercelGatewayFallbackModels';

type InputMode = 'file' | 'pr';

// Simple hash function for file content (for caching purposes)
async function hashFileContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generic system prompt that works for both modes
const GENERIC_SYSTEM_PROMPT =
  'You are a code reviewer. You will be given either a file path or a GitHub pull request URL, and you will review the code accordingly. For file paths, review the single file. For pull requests, review all changed files in the PR.';

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [systemPrompt, setSystemPrompt] = useState(GENERIC_SYSTEM_PROMPT);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fallbackModels, setFallbackModels] = useVercelGatewayFallbackModels();
  const [contextFile, setContextFile] = useState<{
    name: string;
    content: string;
    hash: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update system prompt when input mode changes (only if user hasn't customized it)
  useEffect(() => {
    if (!hasCustomPrompt) {
      setSystemPrompt(GENERIC_SYSTEM_PROMPT);
    }
  }, [inputMode, hasCustomPrompt]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const hash = await hashFileContent(content);
        setContextFile({
          name: file.name,
          content,
          hash,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Failed to read file. Please try again.');
      }
    },
    [],
  );

  // Remove context file
  const handleRemoveContextFile = useCallback(() => {
    setContextFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Use useCallback so the function reference is stable
  const getExtraBody = useCallback(
    () => ({
      systemPrompt,
      ...(fallbackModels.length > 0 && { fallbackModels }),
      ...(contextFile && {
        contextFile: {
          name: contextFile.name,
          content: contextFile.content,
          hash: contextFile.hash, // Include hash for future caching
        },
      }),
    }),
    [systemPrompt, fallbackModels, contextFile],
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
    endpoint: '/api/codereview',
    extraBody: getExtraBody,
  });

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="w-full max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          AI Code Reviewer
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Enter a file path or GitHub PR URL to have it reviewed by an AI agent.
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
            fallbackModels={fallbackModels}
            onFallbackModelsChange={setFallbackModels}
          />

          {/* Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white w-fit"
          >
            <Sparkles size={14} />
            {showSettings ? 'Hide' : 'Show'} Review Settings
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
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setHasCustomPrompt(true);
                  }}
                  placeholder="Enter a custom system prompt for code review..."
                  rows={3}
                  className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 resize-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSystemPrompt(GENERIC_SYSTEM_PROMPT);
                    setHasCustomPrompt(false);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 w-fit"
                >
                  Reset to default
                </button>
              </div>

              {/* Context File Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Repository Context File (Optional)
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Upload a file containing repository context (e.g.,
                  documentation, architecture overview) to help the AI
                  understand your codebase better.
                </p>
                {contextFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                    <FileText
                      size={16}
                      className="text-zinc-600 dark:text-zinc-400"
                    />
                    <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {contextFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveContextFile}
                      className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                    <Upload size={16} />
                    <span>Choose file...</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".txt,.md,.json,.yaml,.yml"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

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
            disabled={isLoading || !inputValue.trim()}
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
