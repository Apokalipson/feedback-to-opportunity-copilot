import type { ReviewMutationInput } from "@/lib/review/contract";

export type ReviewStatus = ReviewMutationInput["reviewStatus"];

export type ReviewResponseItem = {
  sourceRowNumber: number;
  validationStatus: "valid" | "warning" | "invalid";
  texts: Array<{ field: string; label: string; value: string }>;
  q2FeatureCodes: number[];
  q3FeatureCode: number | null;
  issueCodes: string[];
  analysis: {
    topic: string;
    userProblem: string;
    sentiment: string;
    productArea: string;
    confidence: number | null;
  } | null;
};

export type OpportunityReviewCard = {
  id: string;
  importId: string;
  groupLabel: string;
  groupSummary: string;
  scaleCount: number;
  scalePercentage: number;
  userNeed: string;
  potentialSolution: string;
  researchQuestions: string[];
  reviewStatus: ReviewStatus;
  aiGenerated: boolean;
  analysisVersion: string | null;
  updatedAt: string;
  evidence: Array<{
    sourceRowNumber: number;
    quote: string;
  }>;
  history: Array<{
    id: string;
    previousStatus: ReviewStatus | null;
    newStatus: ReviewStatus;
    editedFields: string[];
    reviewNote: string | null;
    createdAt: string;
  }>;
};

export type ReviewWorkspaceData = {
  totalRows: number;
  responses: ReviewResponseItem[];
  cards: OpportunityReviewCard[];
};

export type ReviewApiSuccess = {
  ok: true;
  cardId: string;
  reviewStatus: ReviewStatus;
  updatedAt: string;
};

export type ReviewApiFailure = {
  ok: false;
  code: string;
  message: string;
};

export type ReviewApiResponse = ReviewApiSuccess | ReviewApiFailure;
