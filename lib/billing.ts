// In a real-world application, this data should be stored in a database.
// This is a simulation for demonstration purposes.
// Using in-memory storage - will reset on server restart.

export const modelCosts: Record<string, { input: number; output: number }> = {
  "gpt-4o": {
    input: 0.005 / 1000, // Cost per 1000 tokens
    output: 0.015 / 1000, // Cost per 1000 tokens
  },
  "gemini-1.5-pro": {
    input: 0.00125 / 1000,
    output: 0.005 / 1000,
  },
  "claude-sonnet-4-20250514": {
    input: 0.003 / 1000,
    output: 0.015 / 1000,
  },
  "deepseek-chat": {
    input: 0.00014 / 1000,
    output: 0.00028 / 1000,
  },
  "qwen-plus": {
    input: 0.0008 / 1000,
    output: 0.002 / 1000,
  },
};

// Usage history for tracking (in-memory)
export const usageHistory: Array<{
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}> = [];

// Track total cost instead of remaining credits
export function trackUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { cost: number; totalCost: number } {
  const costs = modelCosts[model] || modelCosts["gpt-4o"];
  const cost = promptTokens * costs.input + completionTokens * costs.output;

  // Track usage
  usageHistory.push({
    timestamp: new Date(),
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cost,
  });

  return { cost, totalCost: getTotalCost() };
}

// Alias for backward compatibility
export const deductCredits = trackUsage;

export function getTotalCost(): number {
  return usageHistory.reduce((sum, entry) => sum + entry.cost, 0);
}

export function getUsageHistory() {
  return usageHistory;
}

// Get cost breakdown by model
export function getCostByModel(): Record<
  string,
  { cost: number; tokens: number; calls: number }
> {
  const breakdown: Record<
    string,
    { cost: number; tokens: number; calls: number }
  > = {};

  for (const entry of usageHistory) {
    if (!breakdown[entry.model]) {
      breakdown[entry.model] = { cost: 0, tokens: 0, calls: 0 };
    }
    breakdown[entry.model].cost += entry.cost;
    breakdown[entry.model].tokens += entry.totalTokens;
    breakdown[entry.model].calls += 1;
  }

  return breakdown;
}

// Legacy function - now returns total cost (for backward compatibility)
export function getCredits() {
  return getTotalCost();
}
