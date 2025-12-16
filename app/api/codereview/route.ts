import { CoreMessage, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { deductCredits, getCredits } from '@/lib/billing';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (getCredits() <= 0) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  const { messages }: { messages: CoreMessage[] } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system: `You are a code reviewer.
You will be given a file path and you will review the code in that file.`,
    tools: {
      readFile: tool({
        description: 'Read the content of a file.',
        parameters: z.object({
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
      deductCredits('gpt-4o', usage.promptTokens, usage.completionTokens);
    },
  });

  return result.toAIStreamResponse();
}

