/**
 * GitHub PR utilities
 */

import { UIMessage } from 'ai';

export interface PRInfo {
  owner: string;
  repo: string;
  prNumber: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extracts PR information from a GitHub PR URL or from message content
 * @param prUrl - Optional explicit PR URL (e.g., "https://github.com/owner/repo/pull/123")
 * @param messages - Optional array of messages to search for PR URLs
 * @returns PR info object with owner, repo, and prNumber, or null if not found
 */
export function extractPRInfo(
  prUrl?: string,
  messages?: UIMessage[] | Array<{ role: string; content: string }>,
): PRInfo | null {
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

      const match = content.match(
        /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i,
      );
      if (match) {
        return { owner: match[1], repo: match[2], prNumber: match[3] };
      }
    }
  }

  return null;
}

/**
 * Posts a comment to a GitHub Pull Request
 * @param githubToken - GitHub personal access token or GitHub Actions token
 * @param prInfo - PR information (owner, repo, prNumber)
 * @param reviewText - The review text to post
 * @param usage - Optional token usage information to include in the comment
 */
export async function postPRComment(
  githubToken: string,
  prInfo: PRInfo,
  reviewText: string,
  usage?: TokenUsage,
): Promise<void> {
  let commentBody = `## 🤖 AI Code Review\n\n${reviewText}`;

  if (usage && usage.totalTokens > 0) {
    commentBody += `\n\n---\n**Usage:** ${usage.promptTokens} prompt + ${usage.completionTokens} completion = ${usage.totalTokens} tokens`;
  }

  const apiUrl = `https://api.github.com/repos/${prInfo.owner}/${prInfo.repo}/issues/${prInfo.prNumber}/comments`;

  console.log('[GitHub] Posting PR comment:', {
    owner: prInfo.owner,
    repo: prInfo.repo,
    prNumber: prInfo.prNumber,
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

    console.log('[GitHub] API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHub] API error response:', {
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
    console.log('[GitHub] Successfully posted PR comment:', {
      commentId: responseData?.id,
      commentUrl: responseData?.html_url,
    });
  } catch (error) {
    console.error('[GitHub] Error posting PR comment:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      prInfo,
      apiUrl,
    });
    throw error;
  }
}
