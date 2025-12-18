import { NextResponse } from 'next/server';
import { postPRComment, extractPRInfo, type TokenUsage } from '@/lib/github-pr';

export async function POST(req: Request) {
  try {
    const {
      reviewText,
      usage,
      prUrl,
      githubToken,
    }: {
      reviewText: string;
      usage?: TokenUsage;
      prUrl?: string;
      githubToken?: string;
    } = await req.json();

    // Validate required fields
    if (!reviewText || !reviewText.trim()) {
      return NextResponse.json(
        { error: 'reviewText is required' },
        { status: 400 },
      );
    }

    // Get GitHub token from request or localStorage (for frontend calls)
    // For GitHub Actions, it should be passed in the request
    const resolvedGithubToken =
      githubToken || req.headers.get('x-github-token') || '';

    if (!resolvedGithubToken) {
      return NextResponse.json(
        { error: 'GitHub token is required' },
        { status: 400 },
      );
    }

    // Extract PR info from URL or try to get from request
    const prInfo = extractPRInfo(prUrl);
    if (!prInfo) {
      return NextResponse.json(
        { error: 'Could not extract PR information from URL' },
        { status: 400 },
      );
    }

    // Post comment to GitHub
    await postPRComment(resolvedGithubToken, prInfo, reviewText, usage);

    return NextResponse.json({
      success: true,
      message: `Comment posted to ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`,
    });
  } catch (error) {
    console.error('[GitHub PR Comment] Error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

