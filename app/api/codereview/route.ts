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

// Helper function to extract PR info from URL or messages
function extractPRInfo(
  prUrl?: string,
  messages?: UIMessage[] | Array<{ role: string; content: string }>,
): { owner: string; repo: string; prNumber: string } | null {
  // First try explicit prUrl parameter
  if (prUrl) {
    const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
    if (match) {
      return { owner: match[1], repo: match[2], prNumber: match[3] };
    }
  }

  // Otherwise, try to extract from messages
  if (messages) {
    for (const message of messages) {
      let content = '';
      
      // Handle UIMessage type (has parts array)
      if ('parts' in message && Array.isArray(message.parts)) {
        content = message.parts
          .map((p: any) => (p.type === 'text' ? p.text : ''))
          .join('');
      }
      // Handle simple { role, content } type
      else if ('content' in message && typeof message.content === 'string') {
        content = message.content;
      }
      // Handle array content type
      else if ('content' in message && Array.isArray(message.content)) {
        content = (message.content as any[])
          .map((p: any) => (p.type === 'text' ? p.text : ''))
          .join('');
      }

      const match = content.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
      if (match) {
        return { owner: match[1], repo: match[2], prNumber: match[3] };
      }
    }
  }

  return null;
}

// Helper function to post comment to GitHub PR
async function postPRComment(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: string,
  reviewText: string,
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number },
): Promise<void> {
  let commentBody = `## 🤖 AI Code Review\n\n${reviewText}`;

  if (usage && usage.totalTokens > 0) {
    commentBody += `\n\n---\n**Usage:** ${usage.promptTokens} prompt + ${usage.completionTokens} completion = ${usage.totalTokens} tokens`;
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  
  console.log('[CodeReview] Posting PR comment:', {
    owner,
    repo,
    prNumber,
    commentLength: commentBody.length,
    tokenPrefix: githubToken.substring(0, 10) + '...',
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Code-Reviewer',
      },
      body: JSON.stringify({ body: commentBody }),
    });

    console.log('[CodeReview] GitHub API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CodeReview] GitHub API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: apiUrl,
      });
      throw new Error(
        `Failed to post PR comment: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const responseData = await response.json().catch(() => null);
    console.log('[CodeReview] Successfully posted PR comment:', {
      commentId: responseData?.id,
      commentUrl: responseData?.html_url,
    });
  } catch (error) {
    console.error('[CodeReview] Error posting PR comment:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      owner,
      repo,
      prNumber,
      apiUrl,
    });
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('[CodeReview] Failed to parse request JSON:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    const {
      messages: rawMessages,
      provider: providerId = 'openai',
      apiKey,
      model: requestedModel,
      stream = true, // Default to streaming
      systemPrompt, // Custom system prompt
      contextFile, // Optional context file with name, content, and hash
      fallbackModels, // Optional fallback models for Vercel AI Gateway
      githubToken, // Optional GitHub token for posting PR comments
      prUrl, // Optional explicit PR URL (otherwise extracted from messages)
      // Note: The hash field enables future caching. If the context file hash hasn't changed,
      // you could cache embeddings or processed context to avoid reprocessing the same content.
      // Cache key could be: `context-${contextFile.hash}` or similar.
    }: {
      messages: UIMessage[] | Array<{ role: string; content: string }>;
      provider?: ProviderId;
      apiKey?: string;
      model?: string;
      stream?: boolean;
      systemPrompt?: string;
      contextFile?: {
        name: string;
        content: string;
        hash: string; // SHA-256 hash of file content for cache invalidation
      };
      fallbackModels?: string[]; // Array of fallback model IDs for Vercel AI Gateway
      githubToken?: string; // GitHub token for posting PR comments
      prUrl?: string; // Explicit PR URL (optional, will be extracted from messages if not provided)
    } = requestBody;

    // Build enhanced system prompt with context file if provided
    let enhancedSystemPrompt =
      systemPrompt ||
      `You are a code reviewer.
You will be given a file path and you will review the code in that file.`;

    if (contextFile) {
      enhancedSystemPrompt += `\n\n## Repository Context\n\nThe following context file (${contextFile.name}) provides additional information about this repository:\n\n${contextFile.content}\n\nUse this context to better understand the codebase when reviewing files.`;
    }

    // Get GitHub token from request or environment
    const resolvedGithubToken =
      githubToken || process.env.GITHUB_TOKEN || undefined;

    // Extract PR info if githubToken is provided
    const prInfo = resolvedGithubToken
      ? extractPRInfo(prUrl, rawMessages)
      : null;

    // If githubToken is provided but no PR info found, warn but continue
    if (resolvedGithubToken && !prInfo) {
      console.warn(
        '[CodeReview] GitHub token provided but no PR URL found in request. Comment will not be posted.',
      );
    }

    // For non-streaming with githubToken, we need to intercept the response to post comment
    if (!stream && resolvedGithubToken && prInfo) {
      try {
        // Call handleAIRequest and get the response
        const response = await handleAIRequest({
          messages: rawMessages,
          provider: providerId,
          apiKey,
          model: requestedModel,
          stream: false,
          systemPrompt: enhancedSystemPrompt,
          tools: codeTools,
          stopWhen: stepCountIs(20),
          enableUsageMetadata: true,
          enableStepLogging: true,
          logPrefix: 'CodeReview',
          contextFileHash: contextFile?.hash,
          fallbackModels,
        });

        // Check if response is an error response
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[CodeReview] handleAIRequest returned error:', errorData);
          return NextResponse.json(
            { error: errorData.error || 'AI request failed' },
            { status: response.status },
          );
        }

        // Extract text and usage from response
        let responseData;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          console.error('[CodeReview] Failed to parse response JSON:', jsonError);
          const responseText = await response.text().catch(() => 'Unable to read response');
          console.error('[CodeReview] Response text:', responseText.substring(0, 500));
          return NextResponse.json(
            { error: 'Failed to parse API response', details: responseText.substring(0, 200) },
            { status: 500 },
          );
        }
        
        // Check if response has error field
        if (responseData.error) {
          console.error('[CodeReview] Response contains error:', responseData.error);
          return NextResponse.json(
            { error: responseData.error },
            { status: 500 },
          );
        }

        const reviewText = responseData.text || '';
        const usage = responseData.usage;

        if (!reviewText) {
          console.error('[CodeReview] No review text in response:', JSON.stringify(responseData, null, 2));
          return NextResponse.json(
            { error: 'No review text generated', responseKeys: Object.keys(responseData) },
            { status: 500 },
          );
        }

        // Post comment to GitHub PR
        if (reviewText && prInfo && resolvedGithubToken) {
          console.log('[CodeReview] Attempting to post PR comment:', {
            hasReviewText: !!reviewText,
            reviewTextLength: reviewText.length,
            prInfo,
            hasToken: !!resolvedGithubToken,
            tokenLength: resolvedGithubToken.length,
            tokenPrefix: resolvedGithubToken.substring(0, 10) + '...',
          });
          
          try {
            await postPRComment(
              resolvedGithubToken,
              prInfo.owner,
              prInfo.repo,
              prInfo.prNumber,
              reviewText,
              usage,
            );
            console.log(
              `[CodeReview] Successfully posted PR comment to ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`,
            );
          } catch (error) {
            console.error('[CodeReview] Failed to post PR comment:', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              prInfo,
              reviewTextLength: reviewText.length,
              usage,
              tokenPrefix: resolvedGithubToken.substring(0, 10) + '...',
            });
            // Don't fail the request if comment posting fails, but log the error
          }
        } else {
          console.warn('[CodeReview] Skipping PR comment post:', {
            hasReviewText: !!reviewText,
            hasPrInfo: !!prInfo,
            hasToken: !!resolvedGithubToken,
            prInfo,
          });
        }

        return NextResponse.json(responseData);
      } catch (error) {
        console.error('[CodeReview] Error in non-streaming with githubToken:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json(
          { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
          { status: 500 },
        );
      }
    }

    // For streaming, we can't easily intercept and post comment, so we'll skip it
    // Users can use non-streaming mode when they want automatic PR comments
    if (stream && resolvedGithubToken && prInfo) {
      console.warn(
        '[CodeReview] GitHub token provided but streaming is enabled. PR comments are only posted for non-streaming requests. Set stream=false to enable automatic PR comments.',
      );
    }

    // Use handleAIRequest from the shared library, with codereview-specific options
    return handleAIRequest({
      messages: rawMessages,
      provider: providerId,
      apiKey,
      model: requestedModel,
      stream,
      systemPrompt: enhancedSystemPrompt,
      tools: codeTools, // Always enable tools for code review
      // Allow up to 20 steps to handle complex reviews with multiple tool calls
      // This covers: reading PR, reading multiple files, and generating the review
      stopWhen: stepCountIs(20),
      enableUsageMetadata: true, // Include usage in streaming response for UI display
      enableStepLogging: true, // Log tool calls for debugging
      logPrefix: 'CodeReview',
      contextFileHash: contextFile?.hash, // Pass hash for provider-level caching
      fallbackModels, // Pass fallback models for Vercel AI Gateway
      // Note: When contextFile.hash is unchanged and user query is identical,
      // OpenAI will automatically return cached responses (faster + cheaper).
      // The hash helps track when context changes and cache should be invalidated.
    });
  } catch (error) {
    console.error('Code review error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    const stack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('Error details:', {
      message,
      stack,
      error: error instanceof Error ? error.toString() : String(error),
    });
    
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack }),
      },
      { status: 500 },
    );
  }
}
