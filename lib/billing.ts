// In a real-world application, this data should be stored in a database.
// This is a simulation for demonstration purposes.

export const modelCosts = {
  'gpt-4o': {
    input: 0.005 / 1000, // Cost per 1000 tokens
    output: 0.015 / 1000, // Cost per 1000 tokens
  },
  // Add other models here
};

export let userCredits = 1.0; // Initial credits in USD

export function deductCredits(model: keyof typeof modelCosts, inputTokens: number, outputTokens: number) {
  const cost = inputTokens * modelCosts[model].input + outputTokens * modelCosts[model].output;
  userCredits -= cost;
  return cost;
}

export function getCredits() {
  return userCredits;
}
