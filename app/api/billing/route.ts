import { getCredits, getUsageHistory } from '@/lib/billing';
import { NextResponse } from 'next/server';

export function GET() {
  const credits = getCredits();
  const usageHistory = getUsageHistory();

  // Calculate total cost from usage history
  const totalCost = usageHistory.reduce((sum, entry) => sum + entry.cost, 0);

  // Calculate total tokens consumed
  const totalTokens = usageHistory.reduce(
    (sum, entry) => sum + entry.totalTokens,
    0,
  );

  return NextResponse.json({
    credits,
    totalCost,
    totalTokens,
    usageHistory: usageHistory.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      model: entry.model,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      totalTokens: entry.totalTokens,
      cost: entry.cost,
    })),
  });
}
