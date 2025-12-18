'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Save, ArrowLeft, Sparkles } from 'lucide-react';

interface ApiKeyConfig {
  id: string;
  name: string;
  placeholder: string;
  key: string;
}

const defaultProviders: ApiKeyConfig[] = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', key: '' },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza...', key: '' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...', key: '' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', key: '' },
  { id: 'qwen', name: 'Qwen (Alibaba)', placeholder: 'sk-...', key: '' },
  { id: 'cohere', name: 'Cohere', placeholder: 'co_...', key: '' },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    placeholder: 'vag_...',
    key: '',
  },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ApiKeyConfig[]>(defaultProviders);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved keys from localStorage
    const savedKeys = localStorage.getItem('ai-api-keys');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        setProviders((prev) =>
          prev.map((p) => ({
            ...p,
            key: parsed[p.id] || '',
          })),
        );
      } catch (e) {
        console.error('Failed to parse saved keys', e);
      }
    }
  }, []);

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateKey = (id: string, value: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, key: value } : p)),
    );
    setSaved(false);
  };

  const handleSave = () => {
    const keysToSave = providers.reduce(
      (acc, p) => ({ ...acc, [p.id]: p.key }),
      {},
    );
    localStorage.setItem('ai-api-keys', JSON.stringify(keysToSave));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white w-fit"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Settings
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Configure your AI provider API keys below.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Sparkles size={20} />
            <h2 className="text-xl font-medium">AI Provider API Keys</h2>
          </div>

          <div className="flex flex-col gap-4">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-col gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <label
                  htmlFor={provider.id}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {provider.name}
                </label>
                <div className="relative flex items-center">
                  <input
                    id={provider.id}
                    type={visibleKeys[provider.id] ? 'text' : 'password'}
                    value={provider.key}
                    onChange={(e) => updateKey(provider.id, e.target.value)}
                    placeholder={provider.placeholder}
                    className="w-full px-3 py-2 pr-10 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(provider.id)}
                    className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {visibleKeys[provider.id] ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 w-full sm:w-fit px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save API Keys'}
          </button>

          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            API keys are stored locally in your browser. They are never sent to
            our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
