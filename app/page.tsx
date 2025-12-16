'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useMemo } from 'react';
import { Code, ChevronDown } from 'lucide-react';

const providers = [
  { id: 'openai', name: 'OpenAI (GPT-4o)', model: 'gpt-4o' },
  { id: 'gemini', name: 'Google Gemini', model: 'gemini-1.5-pro' },
  { id: 'anthropic', name: 'Anthropic (Claude)', model: 'claude-sonnet-4-20250514' },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat' },
  { id: 'qwen', name: 'Qwen (Alibaba)', model: 'qwen-plus' },
];

export default function Home() {
  const [credits, setCredits] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');

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

  // Create a custom transport to inject provider and apiKey
  const transport = useMemo(() => ({
    sendMessages: async ({ messages, abortSignal }: { 
      messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>;
      abortSignal: AbortSignal;
    }) => {
      const response = await fetch('/api/codereview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.parts?.find(p => p.type === 'text')?.text || '',
          })),
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider],
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.body!;
    },
    reconnectToStream: async () => {
      // Not implementing stream reconnection for this use case
      return undefined;
    },
  }), [selectedProvider, apiKeys]);

  const { messages, status, sendMessage } = useChat({
    transport,
    onFinish: () => {
      fetchCredits();
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: inputValue }],
    });
    setInputValue('');
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);

  return (
    <div className="w-full max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          AI Code Reviewer
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Enter the path to a file to have it reviewed by an AI agent.
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
            {isLoading ? 'Reviewing...' : 'Review Code'}
          </button>
        </div>
      </form>

      <div className="flex flex-col-reverse w-full mt-8 gap-4">
        {messages.map(m => (
          <div 
            key={m.id} 
            className="whitespace-pre-wrap p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <strong className="text-zinc-900 dark:text-zinc-100">
              {m.role === 'user' ? 'You: ' : `${currentProvider?.name || 'AI'}: `}
            </strong>
            <span className="text-zinc-700 dark:text-zinc-300">
              {m.parts?.map((part, i) => 
                part.type === 'text' ? <span key={i}>{part.text}</span> : null
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
