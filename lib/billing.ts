// In a real-world application, this data should be stored in a database.
// This is a simulation for demonstration purposes.
// Using in-memory storage - will reset on server restart.

export const modelCosts: Record<string, { input: number; output: number }> = {
  'gpt-4o': {
    input: 0.005 / 1000, // Cost per 1000 tokens
    output: 0.015 / 1000, // Cost per 1000 tokens
  },
  'gemini-1.5-pro': {
    input: 0.00125 / 1000,
    output: 0.005 / 1000,
  },
  'claude-sonnet-4-20250514': {
    input: 0.003 / 1000,
    output: 0.015 / 1000,
  },
  'deepseek-chat': {
    input: 0.00014 / 1000,
    output: 0.00028 / 1000,
  },
  'qwen-plus': {
    input: 0.0008 / 1000,
    output: 0.002 / 1000,
  },
};

export let userCredits = 1.0; // Initial credits in USD

// Usage history for tracking (in-memory)
export const usageHistory: Array<{
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}> = [];

export function deductCredits(
  model: string, 
  promptTokens: number, 
  completionTokens: number
): { cost: number; remaining: number } {
  const costs = modelCosts[model] || modelCosts['gpt-4o'];
  const cost = promptTokens * costs.input + completionTokens * costs.output;
  userCredits -= cost;
  
  // Track usage
  usageHistory.push({
    timestamp: new Date(),
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cost,
  });
  
  return { cost, remaining: userCredits };
}

export function getCredits() {
  return userCredits;
}

export function getUsageHistory() {
  return usageHistory;
}
