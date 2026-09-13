import type { ModelInfo } from "./types";

export const MODELS: ModelInfo[] = [
  {
    id: "MiniMax-M3",
    label: "MiniMax M3",
    contextWindow: 200_000,
    description: "Modèle principal, équilibré et polyvalent.",
  },
];

export const getModel = (id: string): ModelInfo | undefined =>
  MODELS.find((model) => model.id === id);

export const listModels = (extraIds: string[] = []): ModelInfo[] => {
  const knownIds = new Set(MODELS.map((model) => model.id));
  const extras = extraIds
    .filter((id) => !knownIds.has(id))
    .map<ModelInfo>((id) => ({
      id,
      label: id,
      contextWindow: 200_000,
      description: "Modèle personnalisé.",
    }));
  return [...MODELS, ...extras];
};
