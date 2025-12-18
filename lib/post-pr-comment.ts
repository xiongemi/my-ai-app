/**
 * Utility function to post PR comment after code review completes
 */

import { extractPRInfo, type TokenUsage } from './github-pr';
import type { UIMessage } from 'ai';

/**
 * Posts a PR comment after code review streaming completes
 * @param message - The completed message from the AI stream
 * @param allMessages - All messages in the conversation (to extract PR URL)
 */
export async function postPRCommentAfterReview(
  message: UIMessage,
  allMessages: UIMessage[],
): Promise<void> {
  // Extract text from message
  let reviewText = '';
  if ('parts' in message && Array.isArray(message.parts)) {
    reviewText = message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join('');
  } else if ('content' in message && typeof message.content === 'string') {
    reviewText = message.content;
  }

  if (!reviewText) {
    console.warn('[PostPRComment] No review text found in message');
    return;
  }

  // Extract PR info from messages
  const prInfo = extractPRInfo(undefined, allMessages);
  if (!prInfo) {
    console.warn('[PostPRComment] Could not extract PR info from messages');
    return;
  }

  // Get GitHub token from localStorage
  let githubToken = '';
  try {
    const keys = localStorage.getItem('ai-api-keys');
    if (keys) {
      const parsed = JSON.parse(keys);
      githubToken = parsed.githubToken || '';
    }
  } catch {
    // Ignore errors
  }

  if (!githubToken) {
    console.warn('[PostPRComment] No GitHub token found in localStorage');
    return;
  }

  // Extract usage from message
  const usage = (message as any).usage as TokenUsage | undefined;

  // Post comment to GitHub
  try {
    const response = await fetch('/api/github/pr-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewText,
        usage: usage
          ? {
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            }
          : undefined,
        prUrl: `https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.prNumber}`,
        githubToken,
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log('[PostPRComment] Successfully posted PR comment:', data.message);
    } else {
      console.error('[PostPRComment] Failed to post PR comment:', data.error);
    }
  } catch (error) {
    console.error('[PostPRComment] Error posting PR comment:', error);
  }
}

