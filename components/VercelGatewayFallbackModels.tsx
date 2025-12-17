'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { getModelsForProvider, type ModelInfo } from '@/lib/models';

interface VercelGatewayFallbackModelsProps {
  fallbackModels: string[];
  onFallbackModelsChange: (models: string[]) => void;
}

const STORAGE_KEY = 'vercel-gateway-fallback-models';

export function VercelGatewayFallbackModels({
  fallbackModels,
  onFallbackModelsChange,
}: VercelGatewayFallbackModelsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels] = useState<ModelInfo[]>(() =>
    getModelsForProvider('vercel-ai-gateway'),
  );

  const addModel = (modelId: string) => {
    if (!fallbackModels.includes(modelId)) {
      onFallbackModelsChange([...fallbackModels, modelId]);
    }
  };

  const removeModel = (modelId: string) => {
    onFallbackModelsChange(fallbackModels.filter((id) => id !== modelId));
  };

  const availableToAdd = availableModels.filter(
    (model) => !fallbackModels.includes(model.id),
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full max-w-md px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Fallback Models ({fallbackModels.length})
        </span>
        <ChevronDown
          size={16}
          className={`text-zinc-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 max-w-md">
          {/* Current Fallback Models */}
          {fallbackModels.length > 0 ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Current Fallback Models (in order):
              </label>
              <div className="flex flex-col gap-1.5">
                {fallbackModels.map((modelId, index) => {
                  const model = availableModels.find((m) => m.id === modelId);
                  return (
                    <div
                      key={modelId}
                      className="flex items-center justify-between p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {index + 1}.
                        </span>
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">
                          {model?.name || modelId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeModel(modelId)}
                        className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No fallback models configured. Add models below.
            </p>
          )}

          {/* Add Model Dropdown */}
          {availableToAdd.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Add Fallback Model:
              </label>
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addModel(e.target.value);
                      e.target.value = ''; // Reset selection
                    }
                  }}
                  className="w-full appearance-none px-3 py-2 pr-10 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  defaultValue=""
                >
                  <option value="">Select a model to add...</option>
                  {availableToAdd.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}{' '}
                      {model.description && `- ${model.description}`}
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

          {availableToAdd.length === 0 && fallbackModels.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              All available models have been added.
            </p>
          )}

          {/* Info */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Fallback models are used in order if the primary model is
            unavailable.
          </p>
        </div>
      )}
    </div>
  );
}

// Hook to load fallback models from localStorage
export function useVercelGatewayFallbackModels(): [
  string[],
  (models: string[]) => void,
] {
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFallbackModels(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved fallback models', e);
      }
    }
  }, []);

  const updateFallbackModels = (models: string[]) => {
    setFallbackModels(models);
    if (models.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return [fallbackModels, updateFallbackModels];
}
