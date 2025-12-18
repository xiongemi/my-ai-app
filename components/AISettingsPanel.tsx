'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Zap, Clock } from 'lucide-react';
import {
  getModelsForProvider,
  getDefaultModel,
  type ModelInfo,
} from '@/lib/models';
import {
  VercelGatewayFallbackModels,
  useVercelGatewayFallbackModels,
} from './VercelGatewayFallbackModels';
import { useBilling } from './Billing';

export const providers = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'qwen', name: 'Qwen (Alibaba)' },
  { id: 'cohere', name: 'Cohere' },
  { id: 'vercel-ai-gateway', name: 'Vercel AI Gateway' },
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

interface AISettingsPanelProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  useStreaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
  showCredits?: boolean;
  fallbackModels?: string[];
  onFallbackModelsChange?: (models: string[]) => void;
}

export function AISettingsPanel({
  selectedProvider,
  onProviderChange,
  selectedModel,
  onModelChange,
  useStreaming,
  onStreamingChange,
  showCredits = true,
  fallbackModels,
  onFallbackModelsChange,
}: AISettingsPanelProps) {
  // Use the shared useBilling hook instead of local state
  const { billingData, refetch: refetchBilling } = useBilling();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [internalFallbackModels, setInternalFallbackModels] =
    useVercelGatewayFallbackModels();

  // Use prop fallback models if provided, otherwise use internal state
  const currentFallbackModels =
    fallbackModels !== undefined ? fallbackModels : internalFallbackModels;
  const handleFallbackModelsChange =
    onFallbackModelsChange || setInternalFallbackModels;

  // Get available models for the selected provider
  const availableModels = useMemo(
    () => getModelsForProvider(selectedProvider),
    [selectedProvider],
  );

  // Determine the current selected model (use prop or default)
  const currentModel = selectedModel || getDefaultModel(selectedProvider) || '';

  // Handle provider change - reset model to default
  const handleProviderChange = (provider: string) => {
    onProviderChange(provider);
    if (onModelChange) {
      onModelChange(getDefaultModel(provider));
    }
  };

  useEffect(() => {
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
        <div className="flex flex-col gap-1">
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Estimated Cost:{' '}
            <span className="font-semibold text-black dark:text-white">
              ${billingData?.totalCost?.toFixed(4) ?? 0}
            </span>
          </p>
          {billingData.totalTokens !== undefined && (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Estimated Tokens:{' '}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {billingData.totalTokens.toLocaleString()}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Provider Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          AI Provider
        </label>
        <div className="relative w-full max-w-md">
          <select
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
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

      {/* Model Selector */}
      {availableModels.length > 0 && onModelChange && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Model
          </label>
          <div className="relative w-full max-w-md">
            <select
              value={currentModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full appearance-none px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.description && `- ${model.description}`}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Vercel AI Gateway Fallback Models */}
      {selectedProvider === 'vercel-ai-gateway' && (
        <VercelGatewayFallbackModels
          fallbackModels={currentFallbackModels}
          onFallbackModelsChange={handleFallbackModelsChange}
        />
      )}

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
