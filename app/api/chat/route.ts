import { UIMessage } from 'ai';
import { stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { handleAIRequest } from '@/lib/ai-handler';
import { codeTools } from '@/app/api/codereview/route';
import { ProviderId } from '@/lib/providers';

export async function POST(req: Request) {
  try {
    const {
      messages: rawMessages,
      provider: providerId = 'openai',
      apiKey,
      model: requestedModel,
      stream = true,
      systemPrompt,
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

    return handleAIRequest({
      messages: rawMessages,
      provider: providerId,
      apiKey,
      model: requestedModel,
      stream,
      systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
      tools: enableTools ? codeTools : undefined,
      // Allow up to 10 steps for chat (less than codereview since it's simpler)
      stopWhen: enableTools ? stepCountIs(10) : undefined,
      enableUsageMetadata: true, // Include usage in streaming response for UI display
      logPrefix: 'Chat',
    });
  } catch (error) {
    console.error('Chat error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
