'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useMemo } from 'react';
import { MessageCircle, ChevronDown, Zap, Clock, Send, Sparkles } from 'lucide-react';

const providers = [
  { id: 'openai', name: 'OpenAI (GPT-4o)', model: 'gpt-4o' },
  { id: 'gemini', name: 'Google Gemini', model: 'gemini-1.5-pro' },
  { id: 'anthropic', name: 'Anthropic (Claude)', model: 'claude-sonnet-4-20250514' },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat' },
  { id: 'qwen', name: 'Qwen (Alibaba)', model: 'qwen-plus' },
];

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  usage?: UsageInfo;
}

export default function ChatPage() {
  const [credits, setCredits] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [nonStreamingMessages, setNonStreamingMessages] = useState<Message[]>([]);
  const [isNonStreamingLoading, setIsNonStreamingLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [showSettings, setShowSettings] = useState(false);
  const [enableTools, setEnableTools] = useState(false);

  const fetchCredits = async () => {
    const response = await fetch('/api/billing');
    const data = await response.json();
    setCredits(data.credits);
  };

  useEffect(() => {
    fetchCredits();

    // Load API keys from localStorage
    const savedKeys = localStorage.getItem('ai-api-keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error('Failed to parse saved keys', e);
      }
    }
  }, []);

  // Create a custom transport to inject provider, apiKey, and systemPrompt (for streaming)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transport = useMemo(() => ({
    sendMessages: async ({ messages, abortSignal }: { 
      messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>;
      abortSignal?: AbortSignal;
    }) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.parts?.find(p => p.type === 'text')?.text || '',
          })),
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider],
          systemPrompt,
          enableTools,
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
  }) as any, [selectedProvider, apiKeys, systemPrompt, enableTools]);

  const { messages: streamingMessages, status, sendMessage } = useChat({
    transport,
    onFinish: () => {
      fetchCredits();
    },
  });

  const isStreamingLoading = status === 'streaming' || status === 'submitted';
  const isLoading = useStreaming ? isStreamingLoading : isNonStreamingLoading;

  // Non-streaming submit handler
  const handleNonStreamingSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setNonStreamingMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsNonStreamingLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...nonStreamingMessages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider],
          systemPrompt,
          enableTools,
          stream: false,
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

      setNonStreamingMessages(prev => [...prev, assistantMessage]);
      fetchCredits();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsNonStreamingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  
  // Use appropriate messages based on mode
  const displayMessages = useStreaming ? streamingMessages : nonStreamingMessages;

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
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Remaining Credits: <span className="font-semibold text-black dark:text-white">${credits.toFixed(4)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full mt-8">
        <div className="flex flex-col gap-4">
          {/* Model Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI Model
            </label>
            <div className="relative w-full max-w-md">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <ChevronDown 
                size={16} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" 
              />
            </div>
            {!apiKeys[selectedProvider] && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No API key set for {currentProvider?.name}. Add it in Settings.
              </p>
            )}
          </div>

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

          {/* Streaming Toggle */}
          <div className="flex items-center gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setUseStreaming(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                useStreaming 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Zap size={14} />
              Streaming
            </button>
            <button
              type="button"
              onClick={() => setUseStreaming(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !useStreaming 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Clock size={14} />
              Non-Streaming
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {useStreaming ? 'Real-time output' : 'Better usage tracking'}
            </span>
          </div>

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
              disabled={isLoading}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col-reverse w-full mt-8 gap-4">
        {displayMessages.map((m) => (
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
                  {m.usage.promptTokens} prompt + {m.usage.completionTokens} completion = {m.usage.totalTokens} tokens
                </span>
              )}
            </div>
            <span className="text-zinc-700 dark:text-zinc-300">
              {/* Handle both streaming (parts) and non-streaming (content) formats */}
              {'parts' in m && m.parts 
                ? m.parts.map((part, i) => 
                    part.type === 'text' ? <span key={i}>{part.text}</span> : null
                  )
                : 'content' in m ? m.content : ''
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

