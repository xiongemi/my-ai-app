import {
  streamText,
  generateText,
  convertToModelMessages,
  UIMessage,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { deductCredits, getCredits } from '@/lib/billing';
import { NextResponse } from 'next/server';
import { createDeepSeek } from '@ai-sdk/deepseek';
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
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      }),
    defaultModel: getDefaultModel('qwen'),
  },
  'vercel-ai-gateway': {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      }),
    defaultModel: getDefaultModel('vercel-ai-gateway'),
  },
};

export type ProviderId = keyof typeof providerConfigs;

// Shared tools
export const codeTools = {
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
};

export function getEnvApiKey(providerId: ProviderId): string | undefined {
  const envKeys: Record<ProviderId, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    qwen: 'QWEN_API_KEY',
    'vercel-ai-gateway': 'VERCEL_AI_GATEWAY_API_KEY',
  };
  return process.env[envKeys[providerId]];
}

export async function POST(req: Request) {
  try {
    if (getCredits() <= 0) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 },
      );
    }

    const {
      messages: rawMessages,
      provider: providerId = 'openai',
      apiKey,
      model: requestedModel,
      stream = true, // Default to streaming
      systemPrompt, // Custom system prompt
    }: {
      messages: UIMessage[] | Array<{ role: string; content: string }>;
      provider?: ProviderId;
      apiKey?: string;
      model?: string;
      stream?: boolean;
      systemPrompt?: string;
    } = await req.json();

    // Validate messages
    if (!rawMessages || !Array.isArray(rawMessages)) {
      return NextResponse.json(
        { error: 'Messages are required and must be an array' },
        { status: 400 },
      );
    }

    // Convert messages to ModelMessage[] format
    // Streaming sends UIMessage[] format, non-streaming sends {role, content} format
    const messages = stream
      ? convertToModelMessages(rawMessages as UIMessage[])
      : (rawMessages as Array<{ role: string; content: string }>).map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

    // Validate provider
    if (!providerConfigs[providerId]) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const config = providerConfigs[providerId];
    
    // Log for debugging - helps identify provider and key issues
    console.log(
      `[API] Provider: ${providerId}, Model: ${requestedModel || config.defaultModel}, Stream: ${stream}, Has API Key: ${!!apiKey}`,
    );
    
    // Get API key from request or environment
    // IMPORTANT: Never fall back to a different provider's key
    const resolvedApiKey = apiKey || getEnvApiKey(providerId);

    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          error: `No API key provided for ${providerId}. Please add it in Settings.`,
        },
        { status: 400 },
      );
    }

    // Log for debugging - helps identify if wrong key is being used
    console.log(
      `[${providerId}] Requested model: ${requestedModel || config.defaultModel}, API key source: ${apiKey ? 'request body' : 'environment'}`,
    );

    const provider = config.createProvider(resolvedApiKey);
    // Use requested model or fall back to default
    const modelName = requestedModel || config.defaultModel;
    const model = provider(modelName);

    // Use custom system prompt or default
    const finalSystemPrompt =
      systemPrompt ||
      `You are a code reviewer.
You will be given a file path and you will review the code in that file.`;

    if (stream) {
      // Streaming mode - use toUIMessageStreamResponse for proper error handling
      const result = streamText({
        model,
        system: finalSystemPrompt,
        tools: codeTools,
        messages,
        onFinish: ({ usage }) => {
          deductCredits(
            modelName,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
          );
        },
      });

      return result.toUIMessageStreamResponse();
    } else {
      // Non-streaming mode - better for usage tracking
      const result = await generateText({
        model,
        system: finalSystemPrompt,
        tools: codeTools,
        messages,
      });

      // Accurate usage tracking with non-streaming
      // AI SDK v5 uses inputTokens/outputTokens
      const promptTokens = result.usage.inputTokens ?? 0;
      const completionTokens = result.usage.outputTokens ?? 0;
      const billingResult = deductCredits(
        modelName,
        promptTokens,
        completionTokens,
      );

      return NextResponse.json({
        text: result.text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        billing: billingResult,
      });
    }
  } catch (error) {
    console.error('Code review error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
