import { ModelMessage, streamText, generateText } from 'ai';
import { NextResponse } from 'next/server';
import {
  providerConfigs,
  ProviderId,
  getEnvApiKey,
  codeTools,
} from '@/app/api/codereview/route';
import { deductCredits, getCredits } from '@/lib/billing';

export async function POST(req: Request) {
  if (getCredits() <= 0) {
    return NextResponse.json(
      { error: 'Insufficient credits' },
      { status: 402 },
    );
  }

  const {
    messages,
    provider: providerId = 'openai',
    apiKey,
    stream = true,
    systemPrompt, // Custom system prompt
    enableTools = false, // Whether to enable file reading tools
  }: {
    messages: ModelMessage[];
    provider?: ProviderId;
    apiKey?: string;
    stream?: boolean;
    systemPrompt?: string;
    enableTools?: boolean;
  } = await req.json();

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
  const providerInstance = config.createProvider(resolvedApiKey);
  const modelName = config.defaultModel;

  // Default system prompt if none provided
  const finalSystemPrompt = systemPrompt || 'You are a helpful AI assistant.';

  const baseOptions = {
    model: providerInstance(modelName),
    system: finalSystemPrompt,
    messages,
    ...(enableTools && { tools: codeTools }),
  };

  if (stream) {
    // Streaming mode
    const result = await streamText({
      ...baseOptions,
      onFinish: ({ usage }) => {
        deductCredits(
          modelName,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
        );
      },
    });

    return result.toTextStreamResponse();
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
}
