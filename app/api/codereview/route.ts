import { CoreMessage, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { deductCredits, getCredits } from '@/lib/billing';
import { NextResponse } from 'next/server';

// Provider configurations
const providerConfigs = {
  openai: {
    createProvider: (apiKey: string) => createOpenAI({ apiKey }),
    defaultModel: 'gpt-4o',
  },
  gemini: {
    createProvider: (apiKey: string) => createGoogleGenerativeAI({ apiKey }),
    defaultModel: 'gemini-1.5-pro',
  },
  anthropic: {
    createProvider: (apiKey: string) => createAnthropic({ apiKey }),
    defaultModel: 'claude-sonnet-4-20250514',
  },
  deepseek: {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com/v1',
      }),
    defaultModel: 'deepseek-chat',
  },
  qwen: {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      }),
    defaultModel: 'qwen-plus',
  },
};

type ProviderId = keyof typeof providerConfigs;

export async function POST(req: Request) {
  if (getCredits() <= 0) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  const { messages, provider: providerId = 'openai', apiKey }: { 
    messages: CoreMessage[];
    provider?: ProviderId;
    apiKey?: string;
  } = await req.json();

  // Validate provider
  if (!providerConfigs[providerId]) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  // Get API key from request or environment
  const resolvedApiKey = apiKey || getEnvApiKey(providerId);
  
  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: `No API key provided for ${providerId}. Please add it in Settings.` },
      { status: 400 }
    );
  }

  const config = providerConfigs[providerId];
  const providerInstance = config.createProvider(resolvedApiKey);
  const modelName = config.defaultModel;

  const result = await streamText({
    model: providerInstance(modelName),
    system: `You are a code reviewer.
You will be given a file path and you will review the code in that file.`,
    tools: {
      readFile: tool({
        description: 'Read the content of a file.',
        inputSchema: z.object({
          path: z.string().describe('The path to the file to read.'),
        }),
        execute: async ({ path }) => {
          try {
            const content = await readFile(path, 'utf-8');
            return content;
          } catch (error) {
            return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),
    },
    messages,
    onFinish: ({ usage }) => {
      deductCredits(modelName, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
    },
  });

  return result.toTextStreamResponse();
}

function getEnvApiKey(providerId: ProviderId): string | undefined {
  const envKeys: Record<ProviderId, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
  };
  return process.env[envKeys[providerId]];
}

