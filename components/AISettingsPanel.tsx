'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Zap, Clock } from 'lucide-react';

export const providers = [
  { id: 'openai', name: 'OpenAI (GPT-4o)', model: 'gpt-4o' },
  { id: 'gemini', name: 'Google Gemini', model: 'gemini-1.5-pro' },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    model: 'claude-sonnet-4-20250514',
  },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat' },
  { id: 'qwen', name: 'Qwen (Alibaba)', model: 'qwen-plus' },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    model: 'openai/gpt-4o',
  },
];

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  usage?: UsageInfo;
}

export interface BillingData {
  totalCost: number;
  usageHistory: Array<{
    timestamp: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  }>;
}

interface AISettingsPanelProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  useStreaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
  showCredits?: boolean;
}

export function AISettingsPanel({
  selectedProvider,
  onProviderChange,
  useStreaming,
  onStreamingChange,
  showCredits = true,
}: AISettingsPanelProps) {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  const fetchBilling = async () => {
    try {
      const response = await fetch('/api/billing');
      const data = await response.json();
      setBillingData(data);
    } catch (e) {
      console.error('Failed to fetch billing data', e);
    }
  };

  useEffect(() => {
    fetchBilling();

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

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="flex flex-col gap-4">
      {/* Credits/Cost Display */}
      {showCredits && billingData && (
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Total Cost:{' '}
          <span className="font-semibold text-black dark:text-white">
            ${billingData.totalCost.toFixed(4)}
          </span>
        </p>
      )}

      {/* Model Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          AI Model
        </label>
        <div className="relative w-full max-w-md">
          <select
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value)}
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

      {/* Streaming Toggle */}
      <div className="flex items-center gap-3 max-w-md">
        <button
          type="button"
          onClick={() => onStreamingChange(true)}
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
          onClick={() => onStreamingChange(false)}
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
    </div>
  );
}

// Hook to load API keys from localStorage
export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedKeys = localStorage.getItem('ai-api-keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error('Failed to parse saved keys', e);
      }
    }
  }, []);

  return apiKeys;
}

// Hook to fetch billing data
export function useBilling() {
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  const fetchBilling = async () => {
    try {
      const response = await fetch('/api/billing');
      const data = await response.json();
      setBillingData(data);
    } catch (e) {
      console.error('Failed to fetch billing data', e);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  return { billingData, refetch: fetchBilling };
}
