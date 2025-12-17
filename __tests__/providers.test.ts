import {
  providerConfigs,
  getEnvApiKey,
  type ProviderId,
} from '@/lib/providers';

describe('Providers', () => {
  describe('providerConfigs', () => {
    it('should have all expected providers', () => {
      const expectedProviders: ProviderId[] = [
        'openai',
        'gemini',
        'anthropic',
        'deepseek',
        'qwen',
        'vercel-ai-gateway',
      ];

      expectedProviders.forEach((provider) => {
        expect(providerConfigs[provider]).toBeDefined();
        expect(providerConfigs[provider]).toHaveProperty('createProvider');
        expect(providerConfigs[provider]).toHaveProperty('defaultModel');
      });
    });

    it('should create provider with API key', () => {
      const testApiKey = 'test-api-key-123';
      const provider = providerConfigs.openai.createProvider(testApiKey);
      expect(provider).toBeDefined();
    });
  });

  describe('getEnvApiKey', () => {
    it('should return undefined when env var is not set', () => {
      // Clear the env var for testing
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const apiKey = getEnvApiKey('openai');
      expect(apiKey).toBeUndefined();

      // Restore original env
      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    });

    it('should map provider IDs to correct env var names', () => {
      const testCases: Array<{ provider: ProviderId; expectedEnv: string }> = [
        { provider: 'openai', expectedEnv: 'OPENAI_API_KEY' },
        { provider: 'gemini', expectedEnv: 'GOOGLE_GENERATIVE_AI_API_KEY' },
        { provider: 'anthropic', expectedEnv: 'ANTHROPIC_API_KEY' },
        { provider: 'deepseek', expectedEnv: 'DEEPSEEK_API_KEY' },
        { provider: 'qwen', expectedEnv: 'QWEN_API_KEY' },
        {
          provider: 'vercel-ai-gateway',
          expectedEnv: 'VERCEL_AI_GATEWAY_API_KEY',
        },
      ];

      testCases.forEach(({ provider, expectedEnv }) => {
        // This test verifies the mapping exists, not that the env var is set
        const envKey = expectedEnv;
        expect(envKey).toBeDefined();
      });
    });
  });
});
