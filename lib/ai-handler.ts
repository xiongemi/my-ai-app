import {
  streamText,
  generateText,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
  type LanguageModel,
  type ToolSet,
  type StopCondition,
} from 'ai';
import { NextResponse } from 'next/server';
import {
  providerConfigs,
  ProviderId,
  getEnvApiKey,
} from '@/lib/providers';
import { deductCredits, getCredits } from '@/lib/billing';

export interface AIHandlerOptions {
  messages: UIMessage[] | Array<{ role: string; content: string }>;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  stream?: boolean;
  systemPrompt?: string;
  tools?: ToolSet;
  stopWhen?: StopCondition<any> | Array<StopCondition<any>>;
  enableUsageMetadata?: boolean; // Whether to include usage in streaming response metadata
  logPrefix?: string; // Prefix for log messages
  enableStepLogging?: boolean; // Whether to log tool calls and results
}

export async function handleAIRequest(options: AIHandlerOptions) {
  const {
    messages: rawMessages,
    provider: providerId = 'openai',
    apiKey,
    model: requestedModel,
    stream = true,
    systemPrompt,
    tools,
    stopWhen,
    enableUsageMetadata = false,
    logPrefix = 'AI',
    enableStepLogging = false,
  } = options;

  // Check credits
  if (getCredits() <= 0) {
    return NextResponse.json(
      { error: 'Insufficient credits' },
      { status: 402 },
    );
  }

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

  // Log for debugging
  console.log(
    `[${logPrefix}] Provider: ${providerId}, Model: ${requestedModel || config.defaultModel}, Stream: ${stream}, Has API Key: ${!!apiKey}`,
  );

  // Get API key from request or environment
  const resolvedApiKey = apiKey || getEnvApiKey(providerId);

  if (!resolvedApiKey) {
    return NextResponse.json(
      {
        error: `No API key provided for ${providerId}. Please add it in Settings.`,
      },
      { status: 400 },
    );
  }

  // Log for debugging
  console.log(
    `[${logPrefix}] Requested model: ${requestedModel || config.defaultModel}, API key source: ${apiKey ? 'request body' : 'environment'}`,
  );

  const provider = config.createProvider(resolvedApiKey);
  const modelName = requestedModel || config.defaultModel;
  // Type assertion: providers return LanguageModelV1 | LanguageModelV2, but streamText expects LanguageModel
  const model = provider(modelName) as any as LanguageModel;

    if (stream) {
      // Streaming mode
      const result = streamText({
        model,
        system: systemPrompt,
        ...(tools && { tools }),
        messages,
        ...(stopWhen && { stopWhen }),
        onFinish: ({ usage, finishReason }) => {
          console.log(
            `[${logPrefix}] Stream finished. Reason: ${finishReason}, Tokens: ${usage.inputTokens}/${usage.outputTokens}`,
          );
          deductCredits(
            modelName,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
          );
        },
        ...(enableStepLogging && {
          onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
            if (toolCalls && toolCalls.length > 0) {
              console.log(
                `[${logPrefix}] Tool calls made: ${toolCalls.map((tc) => tc.toolName).join(', ')}`,
              );
            }
            if (toolResults && toolResults.length > 0) {
              console.log(
                `[${logPrefix}] Tool results received: ${toolResults.length} results, Step finish reason: ${finishReason}`,
              );
            }
          },
        }),
      });

    return result.toUIMessageStreamResponse({
      ...(enableUsageMetadata && {
        messageMetadata: ({ part }) => {
          // Include usage information when available
          if (part.type === 'finish') {
            return {
              usage: {
                promptTokens: part.totalUsage?.inputTokens ?? 0,
                completionTokens: part.totalUsage?.outputTokens ?? 0,
                totalTokens:
                  part.totalUsage?.totalTokens ??
                  (part.totalUsage?.inputTokens ?? 0) +
                    (part.totalUsage?.outputTokens ?? 0),
              },
            };
          }
          return undefined;
        },
      }),
      onFinish: ({ messages, responseMessage }) => {
        console.log(
          `[${logPrefix}] Stream completed. Response message ID: ${responseMessage.id}`,
        );
      },
    });
  } else {
    // Non-streaming mode - better for usage tracking
    const result = await generateText({
      model,
      system: systemPrompt,
      ...(tools && { tools }),
      messages,
    });

    // Accurate usage tracking - AI SDK v5 uses inputTokens/outputTokens
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
}

