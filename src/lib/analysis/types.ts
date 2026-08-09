export type AnalysisApiSuccess = {
  ok: true;
  importId: string;
  model: string;
  version: string;
  analyzedResponses: number;
  groups: number;
  cards: number;
  evidenceLinks: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

export type AnalysisApiFailure = {
  ok: false;
  code: string;
  message: string;
};

export type AnalysisApiResponse = AnalysisApiSuccess | AnalysisApiFailure;
