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
import { providerConfigs, ProviderId, getEnvApiKey } from '@/lib/providers';
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
  contextFileHash?: string; // Hash of context file for cache key generation
  fallbackModels?: string[]; // Fallback models for Vercel AI Gateway (providerOptions.gateway.models)
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
    contextFileHash,
    fallbackModels,
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
  // For streaming: rawMessages is UIMessage[] format
  // For non-streaming: rawMessages is Array<{ role: string; content: string }> format
  // Normalize to UIMessage[] format first, then convert to ModelMessage[]
  let normalizedMessages: UIMessage[];

  if (stream) {
    // Streaming mode already sends UIMessage[] format
    normalizedMessages = rawMessages as UIMessage[];
  } else {
    // Non-streaming mode sends simple format, convert to UIMessage[] format
    // UIMessage can have either 'content' (string) or 'parts' (array)
    normalizedMessages = (
      rawMessages as Array<{ role: string; content: string }>
    ).map((m) => ({
      id: `msg-${Date.now()}-${Math.random()}`,
      role: m.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: m.content }],
    })) as unknown as UIMessage[];
  }

  let messages = convertToModelMessages(normalizedMessages);

  // Cohere requires messages to have either content or tool calls
  // Filter out messages that have neither (which shouldn't happen, but be safe)
  if (providerId === 'cohere') {
    messages = messages.filter((m, i) => {
      // Check if content exists and is non-empty (handle string or array types)
      const contentStr =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((p: any) => (p.type === 'text' ? p.text : ''))
                .join('')
            : '';
      const hasContent = !!contentStr && contentStr.trim().length > 0;
      const hasToolCalls = !!(m as any).toolCalls?.length;
      const hasToolResults = !!(m as any).toolResults?.length;
      const isValid = hasContent || hasToolCalls || hasToolResults;

      if (!isValid) {
        console.warn(
          `[${logPrefix}] Filtering out invalid message at index ${i}: no content, tool calls, or tool results`,
        );
      }

      return isValid;
    });

    // Log messages for debugging
    console.log(
      `[${logPrefix}] Converted messages (${messages.length} valid):`,
      JSON.stringify(
        messages.map((m, i) => {
          const contentStr =
            typeof m.content === 'string'
              ? m.content
              : Array.isArray(m.content)
                ? m.content
                    .map((p: any) => (p.type === 'text' ? p.text : ''))
                    .join('')
                : '';
          return {
            index: i,
            role: m.role,
            hasContent: !!contentStr && contentStr.length > 0,
            contentLength: contentStr.length,
            hasToolCalls: !!(m as any).toolCalls?.length,
            hasToolResults: !!(m as any).toolResults?.length,
          };
        }),
        null,
        2,
      ),
    );
  }

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

  // Provider-level caching explanation:
  // - OpenAI automatically caches responses when the exact same prompt is sent
  // - If contextFileHash is unchanged AND user query is identical, the full prompt (system + messages) will be identical
  // - OpenAI will then return cached responses automatically (faster + cheaper)
  // - The contextFileHash helps track when context changes, ensuring cache invalidation when needed
  // Note: Some providers may require explicit cache headers/options, but OpenAI's caching is automatic for identical prompts
  if (contextFileHash) {
    console.log(
      `[${logPrefix}] Context file hash: ${contextFileHash.substring(0, 8)}... (caching enabled when prompt is identical)`,
    );
  }

  if (stream) {
    // Streaming mode
    // Store usage and text from onFinish to use in messageMetadata and for PR comments
    let streamUsage: { inputTokens: number; outputTokens: number } | null =
      null;
    let collectedText: string | null = null;

    const result = streamText({
      model,
      system: systemPrompt,
      ...(tools && { tools }),
      messages,
      ...(stopWhen && { stopWhen }),
      // Add providerOptions for Vercel AI Gateway fallback models
      ...(providerId === 'vercel-ai-gateway' &&
        fallbackModels &&
        fallbackModels.length > 0 && {
          providerOptions: {
            gateway: {
              models: fallbackModels,
            },
          },
        }),
      onFinish: ({ text, usage, finishReason }: { text: string; usage: { inputTokens?: number; outputTokens?: number }; finishReason: string }) => {
        console.log(
          `[${logPrefix}] Stream finished. Reason: ${finishReason}, Tokens: ${usage.inputTokens}/${usage.outputTokens}`,
        );
        // Store text and usage for messageMetadata
        collectedText = text;
        streamUsage = {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        };
        
        deductCredits(
          modelName,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
        );
      },
      ...(enableStepLogging && {
        onStepFinish: ({ text, toolCalls, toolResults, finishReason }: { text: string; toolCalls?: Array<{ toolName: string }>; toolResults?: unknown[]; finishReason: string }) => {
          if (toolCalls && toolCalls.length > 0) {
            console.log(
              `[${logPrefix}] Tool calls made: ${toolCalls.map((tc: { toolName: string }) => tc.toolName).join(', ')}`,
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
        messageMetadata: ({ part }: { part: { type: string; totalUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } } }) => {
          // Include usage information when available
          if (part.type === 'finish') {
            // Log what's available in part
            console.log(
              `[${logPrefix}] messageMetadata called for finish part:`,
              JSON.stringify({
                hasTotalUsage: !!part.totalUsage,
                totalUsage: part.totalUsage,
                hasStreamUsage: !!streamUsage,
                streamUsage,
              }),
            );

            // Try to get usage from part.totalUsage first, then fall back to stored streamUsage
            const usage = part.totalUsage
              ? {
                  promptTokens: part.totalUsage.inputTokens ?? 0,
                  completionTokens: part.totalUsage.outputTokens ?? 0,
                  totalTokens:
                    part.totalUsage.totalTokens ??
                    (part.totalUsage.inputTokens ?? 0) +
                      (part.totalUsage.outputTokens ?? 0),
                }
              : streamUsage
                ? {
                    promptTokens: streamUsage.inputTokens,
                    completionTokens: streamUsage.outputTokens,
                    totalTokens:
                      streamUsage.inputTokens + streamUsage.outputTokens,
                  }
                : {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                  };

            console.log(
              `[${logPrefix}] Attaching usage metadata to message:`,
              JSON.stringify(usage),
            );

            return { usage };
          }
          return undefined;
        },
      }),
      onFinish: ({ messages, responseMessage }: { messages: unknown[]; responseMessage: { id: string } & { usage?: unknown } }) => {
        console.log(
          `[${logPrefix}] Stream completed. Response message ID: ${responseMessage.id}`,
        );
        // Log usage if available in the response message
        if (enableUsageMetadata && (responseMessage as any).usage) {
          console.log(
            `[${logPrefix}] Usage attached to response message:`,
            (responseMessage as any).usage,
          );
        } else if (enableUsageMetadata && streamUsage) {
          console.log(
            `[${logPrefix}] Usage was available but not attached. Stream usage:`,
            streamUsage,
          );
        }
      },
    });
  } else {
    // Non-streaming mode - better for usage tracking
    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        ...(tools && { tools }),
        messages,
        ...(stopWhen && { stopWhen }), // Include stopWhen for non-streaming too
        // Add providerOptions for Vercel AI Gateway fallback models
        ...(providerId === 'vercel-ai-gateway' &&
          fallbackModels &&
          fallbackModels.length > 0 && {
            providerOptions: {
              gateway: {
                models: fallbackModels,
              },
            },
          }),
      });

      // Log result for debugging
      console.log(
        `[${logPrefix}] Non-streaming result:`,
        JSON.stringify({
          hasText: !!result.text,
          textLength: result.text?.length ?? 0,
          textPreview: result.text?.substring(0, 100) ?? 'N/A',
          finishReason: result.finishReason,
          stepsCount: (result as any).steps?.length ?? 0,
          usage: result.usage,
        }),
      );

      // Extract text from result - check both result.text and steps
      let finalText = result.text || '';

      // If no text but we have steps, try to extract text from the last step
      if (!finalText && (result as any).steps) {
        const steps = (result as any).steps;
        // Look for text in the last step's content
        const lastStep = steps[steps.length - 1];
        if (lastStep?.content) {
          // Extract text parts from content array
          const textParts = lastStep.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');
          if (textParts) {
            finalText = textParts;
            console.log(
              `[${logPrefix}] Extracted text from steps: ${textParts.length} chars`,
            );
          }
        }
      }

      // If still no text and finishReason is tool-calls, the model made tool calls but hasn't generated final response
      if (!finalText && result.finishReason === 'tool-calls') {
        console.warn(
          `[${logPrefix}] Model made tool calls but no final text generated. This might indicate the model needs more steps.`,
        );
        finalText =
          'The model processed your request and made tool calls, but the final response is not yet available. Please try using streaming mode for better tool call handling.';
      }

      // Accurate usage tracking - AI SDK v5 uses inputTokens/outputTokens
      const promptTokens = result.usage.inputTokens ?? 0;
      const completionTokens = result.usage.outputTokens ?? 0;
      const billingResult = deductCredits(
        modelName,
        promptTokens,
        completionTokens,
      );

      return NextResponse.json({
        text: finalText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        billing: billingResult,
      });
    } catch (error: any) {
      // Handle AI_APICallError first (e.g., "Method Not Allowed" from provider API)
      if (
        error?.name === 'AI_APICallError' ||
        error?.message?.includes('Method Not Allowed')
      ) {
        const errorMessage = error?.message || 'Unknown API error';
        const providerInfo =
          providerId === 'vercel-ai-gateway' ? 'Vercel AI Gateway' : providerId;

        console.error(`[${logPrefix}] API call failed for ${providerInfo}:`, {
          errorMessage,
          model: requestedModel || modelName,
          hasApiKey: !!apiKey,
          hasFallbackModels: !!fallbackModels && fallbackModels.length > 0,
          fallbackModels,
        });

        // Provide helpful error message
        let helpfulMessage = `AI provider API error: ${errorMessage}`;
        if (errorMessage.includes('Method Not Allowed')) {
          helpfulMessage += `. This usually means:
- The API key may be invalid or expired
- The model "${requestedModel || modelName}" may not be available for ${providerInfo}
- For Vercel AI Gateway: Verify your API key has access to the gateway and the requested models
- For Vercel AI Gateway: Check that fallback models are in correct format (e.g., "deepseek/deepseek-coder")`;
        }

        return NextResponse.json(
          {
            error: helpfulMessage,
            details: errorMessage,
            provider: providerInfo,
            model: requestedModel || modelName,
          },
          { status: 502 }, // Bad Gateway - indicates upstream API error
        );
      }

      // Handle citation parsing errors where the API returns valid text but citations format doesn't match SDK expectations
      // Some providers (like Cohere) return citations with tool_output instead of document field
      // The error.value contains the raw API response with the actual text
      // Error structure: AI_APICallError -> cause: [Error[AI_TypeValidationError]] -> value: {message, usage}

      // Log error structure for debugging
      console.log(`[${logPrefix}] Caught error:`, {
        errorName: error?.name,
        errorMessage: error?.message?.substring(0, 100),
        hasValue: !!error?.value,
        hasMessage: !!error?.value?.message,
        hasContent: !!error?.value?.message?.content,
        contentIsArray: Array.isArray(error?.value?.message?.content),
        hasCitations: !!error?.value?.message?.citations,
        hasResponseBody: !!error?.responseBody,
      });

      // Try to get the response data from error.value or parse from responseBody
      let responseData = error?.value;
      if (!responseData?.message?.content && error?.responseBody) {
        try {
          responseData = JSON.parse(error.responseBody);
          console.log(
            `[${logPrefix}] Parsed responseBody to get response data`,
          );
        } catch (e) {
          console.warn(`[${logPrefix}] Failed to parse responseBody:`, e);
        }
      }

      const hasValueWithMessage =
        responseData?.message?.content &&
        Array.isArray(responseData.message.content);

      // If we have valid response data (error.value.message.content), extract the text
      // This handles citation parsing errors where the API returns valid text but citations format doesn't match SDK expectations
      if (hasValueWithMessage) {
        console.log(
          `[${logPrefix}] Error handler check:`,
          JSON.stringify({
            hasValueWithMessage,
            hasInvalidJson: error?.message?.includes('Invalid JSON response'),
            hasCitations: !!responseData?.message?.citations,
            willExtract: true,
          }),
        );
        console.log(
          `[${logPrefix}] Detected citation error with valid response data - extracting text`,
        );
        console.warn(
          `[${logPrefix}] Citation format mismatch detected, extracting text manually from response data`,
        );

        // Extract text from the API response format
        const apiMessage = responseData.message;
        let extractedText = '';

        if (Array.isArray(apiMessage.content)) {
          extractedText = apiMessage.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');
        }

        if (extractedText) {
          // Extract usage from response data if available
          // Cohere uses: usage.tokens.input_tokens / usage.tokens.output_tokens
          // Some providers use input_tokens/output_tokens format, others use inputTokens/outputTokens
          const usage = responseData?.usage?.tokens || responseData?.usage;
          const promptTokens =
            usage?.input_tokens ??
            usage?.inputTokens ??
            responseData?.usage?.billed_units?.input_tokens ??
            0;
          const completionTokens =
            usage?.output_tokens ??
            usage?.outputTokens ??
            responseData?.usage?.billed_units?.output_tokens ??
            0;

          console.log(
            `[${logPrefix}] Extracted text from API response: ${extractedText.length} chars, tokens: ${promptTokens}/${completionTokens}`,
          );

          const billingResult = deductCredits(
            modelName,
            promptTokens,
            completionTokens,
          );

          return NextResponse.json({
            text: extractedText,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
            billing: billingResult,
          });
        } else {
          console.warn(
            `[${logPrefix}] Failed to extract text from error.value.message.content`,
            {
              contentLength: apiMessage.content?.length ?? 0,
              contentTypes: apiMessage.content?.map((p: any) => p?.type),
            },
          );
        }
      }

      console.error(`[${logPrefix}] Error in generateText:`, error);
      // Log the error structure for debugging
      if (error?.value) {
        console.error(
          `[${logPrefix}] Error value structure:`,
          JSON.stringify(
            {
              hasMessage: !!error.value.message,
              hasContent: !!error.value.message?.content,
              hasUsage: !!error.value.usage,
              errorName: error.name,
              errorMessage: error.message,
              causeCount: error.cause?.length ?? 0,
              causeTypes: error.cause?.map((c: any) => c?.name || c?.code),
            },
            null,
            2,
          ),
        );
      }
      throw error;
    }
  }
}
