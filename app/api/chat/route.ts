import { CoreMessage, streamText, generateText } from "ai";
import { NextResponse } from "next/server";
import {
  providerConfigs,
  ProviderId,
  resolveApiKey,
  codeTools,
  getProviderAndModel,
} from "@/lib/ai-providers";
import { deductCredits } from "@/lib/billing";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

export async function POST(req: Request) {
  const {
    messages,
    provider: providerId = "openai",
    apiKey,
    stream = true,
    systemPrompt,
    enableTools = false,
  }: {
    messages: CoreMessage[];
    provider?: ProviderId;
    apiKey?: string;
    stream?: boolean;
    systemPrompt?: string;
    enableTools?: boolean;
  } = await req.json();

  // Validate provider
  if (!providerConfigs[providerId]) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Get API key from request or environment
  const resolvedApiKey = resolveApiKey(providerId, apiKey);

  if (!resolvedApiKey) {
    return NextResponse.json(
      {
        error: `No API key provided for ${providerId}. Please add it in Settings.`,
      },
      { status: 400 },
    );
  }

  const { provider, modelName } = getProviderAndModel(providerId, resolvedApiKey);
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const baseOptions = {
    model: provider(modelName),
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
