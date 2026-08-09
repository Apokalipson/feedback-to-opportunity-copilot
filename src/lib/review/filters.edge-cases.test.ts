import { describe, expect, it } from "vitest";
import { filterCards, filterResponses } from "@/lib/review/filters";
import type {
  OpportunityReviewCard,
  ReviewResponseItem,
} from "@/lib/review/types";

const responses: ReviewResponseItem[] = [
  {
    sourceRowNumber: 3,
    validationStatus: "warning",
    texts: [
      {
        field: "q5_comment",
        label: "Open feedback",
        value: "Refresh is SLOW after the session ends.",
      },
    ],
    q2FeatureCodes: [3],
    q3FeatureCode: 3,
    issueCodes: ["other_text_missing"],
    analysis: {
      topic: "performance",
      userProblem: "Location updates arrive too slowly.",
      sentiment: "negative",
      productArea: "find_my_glo",
      confidence: 0.91,
    },
  },
  {
    sourceRowNumber: 7,
    validationStatus: "valid",
    texts: [
      {
        field: "q3b_feature_comment",
        label: "Feature feedback",
        value: "The recovery steps are clear.",
      },
    ],
    q2FeatureCodes: [2],
    q3FeatureCode: 2,
    issueCodes: [],
    analysis: {
      topic: "clarity",
      userProblem: "Users need predictable recovery guidance.",
      sentiment: "positive",
      productArea: "my_lock",
      confidence: 0.77,
    },
  },
  {
    sourceRowNumber: 11,
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
    id: "40000000-0000-4000-8000-000000000001",
    importId: "20000000-0000-4000-8000-000000000001",
    groupLabel: "Location freshness",
    groupSummary: "Users need timely updates.",
    scaleCount: 1,
    scalePercentage: 25,
    userNeed: "Users need fresh location information.",
    potentialSolution: "Explore a manual refresh control.",
    researchQuestions: ["When is stale location most disruptive?"],
    reviewStatus: "pending",
    aiGenerated: true,
    analysisVersion: "analysis-v1",
    updatedAt: "2026-08-09T12:00:00.000Z",
    evidence: [{ sourceRowNumber: 3, quote: "Refresh is slow." }],
    history: [],
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    importId: "20000000-0000-4000-8000-000000000001",
    groupLabel: "Recovery guidance",
    groupSummary: "Users need clear recovery steps.",
    scaleCount: 2,
    scalePercentage: 50,
    userNeed: "Users need predictable recovery guidance.",
    potentialSolution: "Prototype a guided recovery state.",
    researchQuestions: ["Which interruption is most confusing?"],
    reviewStatus: "approved",
    aiGenerated: true,
    analysisVersion: "analysis-v1",
    updatedAt: "2026-08-09T12:05:00.000Z",
    evidence: [{ sourceRowNumber: 7, quote: "Recovery steps are clear." }],
    history: [],
  },
];

const allResponseFilters = {
  query: "",
  validationStatus: "all",
  topic: "all",
  sentiment: "all",
  productArea: "all",
};

describe("Review filter edge cases", () => {
  it("trims search whitespace and searches case-insensitively", () => {
    expect(
      filterResponses(responses, {
        ...allResponseFilters,
        query: "  sLoW  ",
      }),
    ).toEqual([responses[0]]);

    expect(filterCards(cards, { query: "  MANUAL REFRESH  ", reviewStatus: "all" }))
      .toEqual([cards[0]]);
  });

  it("supports every response filter and their intersection", () => {
    expect(
      filterResponses(responses, {
        query: "location",
        validationStatus: "warning",
        topic: "performance",
        sentiment: "negative",
        productArea: "find_my_glo",
      }),
    ).toEqual([responses[0]]);

    expect(
      filterResponses(responses, {
        query: "location",
        validationStatus: "warning",
        topic: "performance",
        sentiment: "positive",
        productArea: "find_my_glo",
      }),
    ).toEqual([]);
  });

  it("keeps unanalyzed rows available by validation status and source row", () => {
    expect(
      filterResponses(responses, {
        ...allResponseFilters,
        query: "row 11",
        validationStatus: "invalid",
      }),
    ).toEqual([responses[2]]);

    expect(
      filterResponses(responses, {
        ...allResponseFilters,
        topic: "performance",
      }),
    ).not.toContain(responses[2]);
  });

  it("returns explicit empty results for unmatched queries and statuses", () => {
    expect(
      filterResponses(responses, {
        ...allResponseFilters,
        query: "no synthetic record contains this",
      }),
    ).toEqual([]);
    expect(filterCards(cards, { query: "", reviewStatus: "rejected" })).toEqual([]);
  });

  it("searches every card field exposed by the card-search contract", () => {
    const queries = [
      "location freshness",
      "timely updates",
      "fresh location information",
      "manual refresh control",
      "stale location most disruptive",
      "refresh is slow",
    ];

    for (const query of queries) {
      expect(filterCards(cards, { query, reviewStatus: "pending" })).toEqual([
        cards[0],
      ]);
    }
  });

  it("preserves input order and does not mutate the source collections", () => {
    const responseSnapshot = structuredClone(responses);
    const cardSnapshot = structuredClone(cards);

    expect(filterResponses(responses, allResponseFilters)).toEqual(responses);
    expect(filterCards(cards, { query: "", reviewStatus: "all" })).toEqual(cards);
    expect(responses).toEqual(responseSnapshot);
    expect(cards).toEqual(cardSnapshot);
  });
});
