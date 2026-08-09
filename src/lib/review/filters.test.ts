import { describe, expect, it } from "vitest";
import { filterCards, filterResponses } from "@/lib/review/filters";
import type {
  OpportunityReviewCard,
  ReviewResponseItem,
} from "@/lib/review/types";

const responses: ReviewResponseItem[] = [
  {
    sourceRowNumber: 1,
    validationStatus: "valid",
    texts: [{ field: "q5_comment", label: "Open feedback", value: "Slow refresh" }],
    q2FeatureCodes: [3],
    q3FeatureCode: 3,
    issueCodes: [],
    analysis: {
      topic: "performance",
      userProblem: "Location updates arrive too slowly.",
      sentiment: "negative",
      productArea: "find_my_glo",
      confidence: 0.9,
    },
  },
  {
    sourceRowNumber: 2,
    validationStatus: "invalid",
    texts: [],
    q2FeatureCodes: [],
    q3FeatureCode: null,
    issueCodes: ["unsupported_q3_code"],
    analysis: null,
  },
];

const cards: OpportunityReviewCard[] = [
  {
    id: "card-1",
    importId: "import-1",
    groupLabel: "Location freshness",
    groupSummary: "Users need timely location updates.",
    scaleCount: 1,
    scalePercentage: 25,
    userNeed: "Users need fresh location information.",
    potentialSolution: "Explore a manual refresh control.",
    researchQuestions: ["When is stale location most disruptive?"],
    reviewStatus: "pending",
    aiGenerated: true,
    analysisVersion: "analysis-v1",
    updatedAt: "2026-08-09T12:00:00.000Z",
    evidence: [
      {
        sourceRowNumber: 1,
        quote: "Slow refresh",
      },
    ],
    history: [],
  },
];

describe("review workspace filters", () => {
  it("searches normalized response text and controlled analysis labels", () => {
    expect(
      filterResponses(responses, {
        query: "refresh",
        validationStatus: "all",
        topic: "performance",
        sentiment: "negative",
        productArea: "find_my_glo",
      }),
    ).toHaveLength(1);
  });

  it("can isolate invalid rows without AI analysis", () => {
    expect(
      filterResponses(responses, {
        query: "",
        validationStatus: "invalid",
        topic: "all",
        sentiment: "all",
        productArea: "all",
      }),
    ).toEqual([responses[1]]);
  });

  it("searches cards and filters review status", () => {
    expect(
      filterCards(cards, { query: "manual refresh", reviewStatus: "pending" }),
    ).toEqual(cards);
    expect(
      filterCards(cards, { query: "manual refresh", reviewStatus: "approved" }),
    ).toEqual([]);
  });
});
