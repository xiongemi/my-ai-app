import modelsConfig from './models.json';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface ProviderModels {
  defaultModel: string;
  models: ModelInfo[];
}

export type ModelsConfig = Record<string, ProviderModels>;

export const models = modelsConfig as ModelsConfig;

export function getModelsForProvider(providerId: string): ModelInfo[] {
  return models[providerId]?.models || [];
}

export function getDefaultModel(providerId: string): string {
  return models[providerId]?.defaultModel || '';
}

export function getModelInfo(
  providerId: string,
  modelId: string,
): ModelInfo | undefined {
  return models[providerId]?.models.find((m) => m.id === modelId);
}

