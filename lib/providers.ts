import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createQwen } from 'qwen-ai-provider';
import { createCohere } from '@ai-sdk/cohere';
import {createGatewayProvider} from '@ai-sdk/gateway';
import { getDefaultModel } from '@/lib/models';

// Provider configurations - exported for reuse
export const providerConfigs = {
  openai: {
    createProvider: (apiKey: string) => createOpenAI({ apiKey }),
    defaultModel: getDefaultModel('openai'),
  },
  gemini: {
    createProvider: (apiKey: string) => createGoogleGenerativeAI({ apiKey }),
    defaultModel: getDefaultModel('gemini'),
  },
  anthropic: {
    createProvider: (apiKey: string) => createAnthropic({ apiKey }),
    defaultModel: getDefaultModel('anthropic'),
  },
  deepseek: {
    createProvider: (apiKey: string) =>
      createDeepSeek({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      }),
    defaultModel: getDefaultModel('deepseek'),
  },
  qwen: {
    createProvider: (apiKey: string) => createQwen({ apiKey }),
    defaultModel: getDefaultModel('qwen'),
  },
  cohere: {
    createProvider: (apiKey: string) => createCohere({ apiKey }),
    defaultModel: getDefaultModel('cohere'),
  },
  'vercel-ai-gateway': {
    // Vercel AI Gateway provider - uses @ai-sdk/gateway
    // Models must be specified in format: "provider/model" (e.g., "openai/gpt-4", "anthropic/claude-3-opus")
    // The gateway provider handles the endpoint URL internally - do not specify baseURL
    // See: https://vercel.com/docs/ai-gateway
    createProvider: (apiKey: string) => createGatewayProvider({ apiKey }),
    defaultModel: getDefaultModel('vercel-ai-gateway'),
  },
};

export type ProviderId = keyof typeof providerConfigs;

export function getEnvApiKey(providerId: ProviderId): string | undefined {
  const envKeys: Record<ProviderId, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
    cohere: 'COHERE_API_KEY',
    'vercel-ai-gateway': 'VERCEL_AI_GATEWAY_API_KEY',
  };
  return process.env[envKeys[providerId]];
}
