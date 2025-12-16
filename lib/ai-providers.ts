import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";
import { readFile } from "fs/promises";

// Provider configurations
export const providerConfigs = {
  openai: {
    createProvider: (apiKey: string) => createOpenAI({ apiKey }),
    defaultModel: "gpt-4o",
  },
  gemini: {
    createProvider: (apiKey: string) => createGoogleGenerativeAI({ apiKey }),
    defaultModel: "gemini-1.5-pro",
  },
  anthropic: {
    createProvider: (apiKey: string) => createAnthropic({ apiKey }),
    defaultModel: "claude-sonnet-4-20250514",
  },
  deepseek: {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com/v1",
      }),
    defaultModel: "deepseek-chat",
  },
  qwen: {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      }),
    defaultModel: "qwen-plus",
  },
  // Vercel AI Gateway - routes to multiple providers through unified API
  "vercel-ai-gateway": {
    createProvider: (apiKey: string) =>
      createOpenAI({
        apiKey,
        baseURL: "https://ai-gateway.vercel.sh/v1",
      }),
    // Format: provider/model - can use any model from supported providers
    defaultModel: "openai/gpt-4o",
  },
};

export type ProviderId = keyof typeof providerConfigs;

// Environment variable mapping for API keys
const envKeyMapping: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "QWEN_API_KEY",
  "vercel-ai-gateway": "VERCEL_AI_GATEWAY_API_KEY",
};

export function getEnvApiKey(providerId: ProviderId): string | undefined {
  return process.env[envKeyMapping[providerId]];
}

// Shared tools for file operations
export const codeTools = {
  readFile: tool({
    description: "Read the content of a file.",
    inputSchema: z.object({
      path: z.string().describe("The path to the file to read."),
    }),
    execute: async ({ path }) => {
      try {
        const content = await readFile(path, "utf-8");
        return content;
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),
};

// Helper to get provider instance and model
export function getProviderAndModel(providerId: ProviderId, apiKey: string) {
  const config = providerConfigs[providerId];
  return {
    provider: config.createProvider(apiKey),
    modelName: config.defaultModel,
  };
}

// Helper to resolve API key from request or environment
export function resolveApiKey(
  providerId: ProviderId,
  requestApiKey?: string,
): string | undefined {
  return requestApiKey || getEnvApiKey(providerId);
}
