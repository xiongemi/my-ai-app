import {
  streamText,
  generateText,
  convertToModelMessages,
  UIMessage,
} from 'ai';
import { NextResponse } from 'next/server';
import {
  providerConfigs,
  ProviderId,
  getEnvApiKey,
  codeTools,
} from '@/app/api/codereview/route';
import { deductCredits, getCredits } from '@/lib/billing';

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
      stream = true,
      systemPrompt, // Custom system prompt
      enableTools = false, // Whether to enable file reading tools
    }: {
      messages: UIMessage[];
      provider?: ProviderId;
      apiKey?: string;
      model?: string;
      stream?: boolean;
      systemPrompt?: string;
      enableTools?: boolean;
    } = await req.json();

    // Validate messages
    if (!rawMessages || !Array.isArray(rawMessages)) {
      return NextResponse.json(
        { error: 'Messages are required and must be an array' },
        { status: 400 },
      );
    }

    // Convert UIMessage[] (from useChat) to ModelMessage[] (for generateText/streamText)
    const messages = convertToModelMessages(rawMessages);

    // Validate provider
    if (!providerConfigs[providerId]) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

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

    const config = providerConfigs[providerId];
    const provider = config.createProvider(resolvedApiKey);
    // Use requested model or fall back to default
    const modelName = requestedModel || config.defaultModel;
    const model = provider(modelName);

    // Default system prompt if none provided
    const finalSystemPrompt = systemPrompt || 'You are a helpful AI assistant.';

    const baseOptions = {
      model,
      system: finalSystemPrompt,
      messages,
      ...(enableTools && { tools: codeTools }),
    };

    if (stream) {
      // Streaming mode - use toUIMessageStreamResponse for proper error handling
      const result = streamText({
        ...baseOptions,
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
      // Non-streaming mode - better for accurate usage tracking
      const result = await generateText(baseOptions);

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
  } catch (error) {
    console.error('Chat error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
