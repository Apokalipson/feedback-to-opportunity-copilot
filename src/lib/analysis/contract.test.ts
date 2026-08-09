import { describe, expect, it } from "vitest";
import {
  ANALYSIS_LIMITS,
  AnalysisContractError,
  prepareAnalysisInput,
  toPersistencePayload,
  validateAnalysisOutput,
  type AnalysisSourceRow,
} from "./contract";

const firstId = "30000000-0000-4000-8000-000000000001";
const secondId = "30000000-0000-4000-8000-000000000002";

const sourceRows: AnalysisSourceRow[] = [
  {
    id: firstId,
    sourceRowNumber: 1,
    normalizedTexts: {
      q5_comment: "The device finder takes too long to update.",
      q4b_ces_comment: "The refresh status is difficult to understand.",
      q1b_csat_comment: null,
    },
    q2FeatureCodes: [1, 3],
    q3FeatureCode: 3,
  },
  {
    id: secondId,
    sourceRowNumber: 2,
    normalizedTexts: {
      q5_comment: "I need clearer session recovery guidance.",
    },
    q2FeatureCodes: [2, 4],
    q3FeatureCode: 4,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    sourceRowNumber: 3,
    normalizedTexts: { q5_comment: null },
    q2FeatureCodes: [],
    q3FeatureCode: null,
  },
];

const validOutput = {
  analyses: [
    {
      response_id: firstId,
      topic: "performance",
      user_problem: "The user cannot confirm the latest device location quickly.",
      sentiment: "negative",
      product_area: "find_my_glo",
      confidence: 0.9,
      uncertainty_reasons: [],
    },
    {
      response_id: secondId,
      topic: "clarity",
      user_problem: "The user lacks clear guidance after a session interruption.",
      sentiment: "mixed",
      product_area: "my_session",
      confidence: 0.8,
      uncertainty_reasons: ["The desired recovery path is not specified."],
    },
  ],
  groups: [
    {
      group_key: "location_freshness",
      label: "Slow location refresh",
      summary: "Users need timely location updates.",
      confidence: 0.9,
      response_ids: [firstId],
    },
    {
      group_key: "session_recovery",
      label: "Unclear session recovery",
      summary: "Users need clearer recovery guidance.",
      confidence: 0.8,
      response_ids: [secondId],
    },
  ],
  cards: [
    {
      group_key: "location_freshness",
      user_need: "Users need timely confirmation of device location.",
      potential_solution: "Investigate freshness indicators and manual refresh.",
      research_questions: ["When does location staleness become disruptive?"],
      evidence: [{ response_id: firstId, text_field: "q5_comment" }],
    },
    {
      group_key: "session_recovery",
      user_need: "Users need clear session recovery guidance.",
      potential_solution: "Investigate a guided recovery state.",
      research_questions: ["Which interruption states create confusion?"],
      evidence: [{ response_id: secondId, text_field: "q5_comment" }],
    },
  ],
};

describe("analysis contract", () => {
  it("prepares only responses with accepted non-empty normalized text", () => {
    const input = prepareAnalysisInput(sourceRows);

    expect(input.responses).toHaveLength(2);
    expect(input.responses[0]).toMatchObject({
      response_id: firstId,
      source_row_number: 1,
      q2_feature_codes: [1, 3],
      q3_feature_code: 3,
    });
    expect(input.prompt.length).toBeLessThan(ANALYSIS_LIMITS.maxInputCharacters);
    expect(input.prompt).not.toContain("30000000-0000-4000-8000-000000000003");
  });

  it("rejects an analysis run above the response limit", () => {
    const tooManyRows = Array.from(
      { length: ANALYSIS_LIMITS.maxResponses + 1 },
      (_, index) => ({
        id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        sourceRowNumber: index + 1,
        normalizedTexts: { q5_comment: `Synthetic feedback ${index + 1}` },
        q2FeatureCodes: [],
        q3FeatureCode: null,
      }),
    );

    expect(() => prepareAnalysisInput(tooManyRows)).toThrowError(
      expect.objectContaining({ code: "analysis_row_limit" }),
    );
  });

  it("validates complete analysis, grouping, cards, and source evidence", () => {
    const input = prepareAnalysisInput(sourceRows);
    const output = validateAnalysisOutput(validOutput, input.responses);
    const payload = toPersistencePayload(output, input.responses);

    expect(payload.analyses).toHaveLength(2);
    expect(payload.groups).toHaveLength(2);
    expect(payload.cards[0].evidence).toEqual([
      {
        response_id: firstId,
        text_field: "q5_comment",
      },
    ]);
  });

  it("rejects missing analyses instead of persisting a partial result", () => {
    const input = prepareAnalysisInput(sourceRows);
    const incomplete = {
      ...validOutput,
      analyses: validOutput.analyses.slice(0, 1),
    };

    expect(() => validateAnalysisOutput(incomplete, input.responses)).toThrowError(
      expect.objectContaining({ code: "invalid_ai_output" }),
    );
  });

  it("rejects a response assigned to multiple groups", () => {
    const input = prepareAnalysisInput(sourceRows);
    const duplicatedMembership = structuredClone(validOutput);
    duplicatedMembership.groups[1].response_ids.push(firstId);

    expect(() =>
      validateAnalysisOutput(duplicatedMembership, input.responses),
    ).toThrow(AnalysisContractError);
  });

  it("rejects evidence that does not exist in the normalized source", () => {
    const input = prepareAnalysisInput(sourceRows);
    const fabricatedEvidence = structuredClone(validOutput);
    fabricatedEvidence.cards[0].evidence[0].text_field = "q2_other_text";

    expect(() =>
      validateAnalysisOutput(fabricatedEvidence, input.responses),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_ai_output" }),
    );
  });

  it("keeps the first valid evidence field when a card repeats a response", () => {
    const input = prepareAnalysisInput(sourceRows);
    const duplicateSourceEvidence = structuredClone(validOutput);
    duplicateSourceEvidence.cards[0].evidence.push({
      response_id: firstId,
      text_field: "q4b_ces_comment",
    });

    const output = validateAnalysisOutput(
      duplicateSourceEvidence,
      input.responses,
    );

    expect(output.cards[0].evidence).toEqual([
      { response_id: firstId, text_field: "q5_comment" },
    ]);
  });

  it("rejects an invalid evidence field even when its response is duplicated", () => {
    const input = prepareAnalysisInput(sourceRows);
    const invalidDuplicateEvidence = structuredClone(validOutput);
    invalidDuplicateEvidence.cards[0].evidence.push({
      response_id: firstId,
      text_field: "q2_other_text",
    });

    expect(() =>
      validateAnalysisOutput(invalidDuplicateEvidence, input.responses),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_ai_output" }),
    );
  });
});
