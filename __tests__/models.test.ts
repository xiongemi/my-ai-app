import {
  getModelsForProvider,
  getDefaultModel,
  getModelInfo,
} from '@/lib/models';

describe('Models', () => {
  describe('getModelsForProvider', () => {
    it('should return models for a valid provider', () => {
      const models = getModelsForProvider('openai');
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
    });

    it('should return empty array for invalid provider', () => {
      const models = getModelsForProvider('invalid-provider');
      expect(models).toEqual([]);
    });
  });

  describe('getDefaultModel', () => {
    it('should return default model for a valid provider', () => {
      const model = getDefaultModel('openai');
      expect(model).toBeDefined();
      expect(typeof model).toBe('string');
    });

    it('should return empty string for invalid provider', () => {
      const model = getDefaultModel('invalid-provider');
      expect(model).toBe('');
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for valid provider and model', () => {
      const defaultModel = getDefaultModel('openai');
      if (defaultModel) {
        const modelInfo = getModelInfo('openai', defaultModel);
        expect(modelInfo).toBeDefined();
        if (modelInfo) {
          expect(modelInfo).toHaveProperty('id');
          expect(modelInfo).toHaveProperty('name');
          expect(modelInfo).toHaveProperty('description');
        }
      }
    });

    it('should return undefined for invalid model', () => {
      const modelInfo = getModelInfo('openai', 'invalid-model-id');
      expect(modelInfo).toBeUndefined();
    });
  });
});
