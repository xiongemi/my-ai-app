import { UIMessage, stepCountIs } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { handleAIRequest } from '@/lib/ai-handler';
import { ProviderId } from '@/lib/providers';

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
  readPullRequest: tool({
    description:
      'Read files from a public GitHub pull request. Provide the PR URL to fetch all changed files and their contents.',
    inputSchema: z.object({
      prUrl: z
        .string()
        .describe(
          'The GitHub PR URL (e.g., https://github.com/owner/repo/pull/123).',
        ),
    }),
    execute: async ({ prUrl }) => {
      try {
        // Parse PR URL: https://github.com/owner/repo/pull/123
        const prUrlMatch = prUrl.match(
          /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i,
        );
        if (!prUrlMatch) {
          return 'Error: Invalid GitHub PR URL format. Expected: https://github.com/owner/repo/pull/123';
        }

        const [, owner, repo, prNumber] = prUrlMatch;

        // Fetch PR files using GitHub REST API (no auth needed for public repos)
        const filesResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
          {
            headers: {
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!filesResponse.ok) {
          if (filesResponse.status === 404) {
            return `Error: PR not found. Make sure the PR is public and the URL is correct.`;
          }
          return `Error fetching PR files: ${filesResponse.status} ${filesResponse.statusText}`;
        }

        const files = await filesResponse.json();

        if (!Array.isArray(files) || files.length === 0) {
          return 'No files found in this pull request.';
        }

        // Format the response with file information
        const fileContents = files.map((file: any) => {
          const content = file.patch || file.contents || '';
          return {
            filename: file.filename,
            status: file.status, // added, modified, removed, renamed
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: content.substring(0, 50000), // Limit patch size
            raw_url: file.contents_url || file.blob_url,
          };
        });

        return JSON.stringify(
          {
            pr_url: prUrl,
            owner,
            repo,
            pr_number: prNumber,
            total_files: files.length,
            files: fileContents,
          },
          null,
          2,
        );
      } catch (error) {
        return `Error reading pull request: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  }),
};

export async function POST(req: Request) {
  try {
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

    // Use handleAIRequest from the shared library, with codereview-specific options
    return handleAIRequest({
      messages: rawMessages,
      provider: providerId,
      apiKey,
      model: requestedModel,
      stream,
      systemPrompt:
        systemPrompt ||
        `You are a code reviewer.
You will be given a file path and you will review the code in that file.`,
      tools: codeTools, // Always enable tools for code review
      // Allow up to 20 steps to handle complex reviews with multiple tool calls
      // This covers: reading PR, reading multiple files, and generating the review
      stopWhen: stepCountIs(20),
      enableUsageMetadata: true, // Include usage in streaming response for UI display
      enableStepLogging: true, // Log tool calls for debugging
      logPrefix: 'CodeReview',
    });
  } catch (error) {
    console.error('Code review error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
