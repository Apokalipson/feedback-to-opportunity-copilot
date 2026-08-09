import { z } from "zod";
import type { NormalizedTextField } from "@/lib/imports/contract";

export const ANALYSIS_VERSION = "analysis-v1";

export const ANALYSIS_LIMITS = {
  maxResponses: 25,
  maxInputCharacters: 20_000,
  maxOutputTokens: 6_000,
  maxGroups: 10,
  maxEvidencePerCard: 3,
  maxQuoteCharacters: 500,
  timeoutMilliseconds: 60_000,
  maxRetries: 1,
} as const;

export const ANALYSIS_TEXT_FIELDS = [
  "q1b_csat_comment",
  "q1c_csat_comment",
  "q1d_csat_comment",
  "q2_other_text",
  "q3_other_text",
  "q3b_feature_comment",
  "q4b_ces_comment",
  "q5_comment",
] as const satisfies readonly NormalizedTextField[];

export const ANALYSIS_TOPICS = [
  "usability",
  "reliability",
  "performance",
  "discoverability",
  "clarity",
  "trust",
  "support",
  "other",
] as const;

export const ANALYSIS_SENTIMENTS = [
  "negative",
  "mixed",
  "neutral",
  "positive",
] as const;

export const ANALYSIS_PRODUCT_AREAS = [
  "my_display",
  "my_lock",
  "find_my_glo",
  "my_session",
  "my_usage",
  "ecosystem_other",
] as const;

const featureCodeSchema = z.number().int().min(1).max(6);
const textFieldSchema = z.enum(ANALYSIS_TEXT_FIELDS);

export const analysisOutputWireSchema = z.object({
  analyses: z.array(
    z.object({
      response_id: z.string(),
      topic: z.enum(ANALYSIS_TOPICS),
      user_problem: z.string(),
      sentiment: z.enum(ANALYSIS_SENTIMENTS),
      product_area: z.enum(ANALYSIS_PRODUCT_AREAS),
      confidence: z.number(),
      uncertainty_reasons: z.array(z.string()),
    }),
  ),
  groups: z.array(
    z.object({
      group_key: z.string(),
      label: z.string(),
      summary: z.string(),
      confidence: z.number(),
      response_ids: z.array(z.string()),
    }),
  ),
  cards: z.array(
    z.object({
      group_key: z.string(),
      user_need: z.string(),
      potential_solution: z.string(),
      research_questions: z.array(z.string()),
      evidence: z.array(
        z.object({
          response_id: z.string(),
          text_field: textFieldSchema,
        }),
      ),
    }),
  ),
});

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

const analysisOutputBusinessSchema = z.object({
  analyses: z
    .array(
      z.object({
        response_id: z.string().uuid(),
        topic: z.enum(ANALYSIS_TOPICS),
        user_problem: boundedText(1_000),
        sentiment: z.enum(ANALYSIS_SENTIMENTS),
        product_area: z.enum(ANALYSIS_PRODUCT_AREAS),
        confidence: z.number().min(0).max(1),
        uncertainty_reasons: z.array(boundedText(300)).max(3),
      }),
    )
    .max(ANALYSIS_LIMITS.maxResponses),
  groups: z
    .array(
      z.object({
        group_key: boundedText(64).regex(/^[a-z0-9_-]+$/u),
        label: boundedText(160),
        summary: boundedText(1_000),
        confidence: z.number().min(0).max(1),
        response_ids: z
          .array(z.string().uuid())
          .min(1)
          .max(ANALYSIS_LIMITS.maxResponses),
      }),
    )
    .min(1)
    .max(ANALYSIS_LIMITS.maxGroups),
  cards: z
    .array(
      z.object({
        group_key: boundedText(64).regex(/^[a-z0-9_-]+$/u),
        user_need: boundedText(1_000),
        potential_solution: boundedText(1_500),
        research_questions: z.array(boundedText(500)).min(1).max(4),
        evidence: z
          .array(
            z.object({
              response_id: z.string().uuid(),
              text_field: textFieldSchema,
            }),
          )
          .min(1)
          .max(ANALYSIS_LIMITS.maxEvidencePerCard),
      }),
    )
    .min(1)
    .max(ANALYSIS_LIMITS.maxGroups),
});

export type AnalysisOutput = z.infer<typeof analysisOutputBusinessSchema>;

export type AnalysisSourceRow = {
  id: string;
  sourceRowNumber: number;
  normalizedTexts: unknown;
  q2FeatureCodes: unknown;
  q3FeatureCode: unknown;
};

export type AnalysisInputResponse = {
  response_id: string;
  source_row_number: number;
  q2_feature_codes: number[];
  q3_feature_code: number | null;
  texts: Array<{ field: NormalizedTextField; text: string }>;
};

export type PreparedAnalysisInput = {
  prompt: string;
  responses: AnalysisInputResponse[];
};

export type AnalysisPersistencePayload = {
  analyses: Array<{
    response_id: string;
    topic: (typeof ANALYSIS_TOPICS)[number];
    user_problem: string;
    sentiment: (typeof ANALYSIS_SENTIMENTS)[number];
    product_area: (typeof ANALYSIS_PRODUCT_AREAS)[number];
    confidence: number;
    uncertainty_reasons: string[];
  }>;
  groups: Array<{
    group_key: string;
    label: string;
    summary: string;
    confidence: number;
    response_ids: string[];
  }>;
  cards: Array<{
    group_key: string;
    user_need: string;
    potential_solution: string;
    research_questions: string[];
    evidence: Array<{
      response_id: string;
      text_field: NormalizedTextField;
    }>;
  }>;
};

export class AnalysisContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisContractError";
  }
}

function readTexts(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AnalysisContractError(
      "invalid_source_data",
      "The normalized survey data is not structurally valid.",
    );
  }

  const record = value as Record<string, unknown>;
  return ANALYSIS_TEXT_FIELDS.flatMap((field) => {
    const candidate = record[field];
    if (candidate === null || candidate === undefined) {
      return [];
    }
    if (typeof candidate !== "string") {
      throw new AnalysisContractError(
        "invalid_source_data",
        "The normalized survey data is not structurally valid.",
      );
    }

    const text = candidate.trim();
    return text.length > 0 ? [{ field, text }] : [];
  });
}

export function prepareAnalysisInput(
  rows: AnalysisSourceRow[],
): PreparedAnalysisInput {
  const responses = rows.flatMap((row) => {
    const id = z.string().uuid().safeParse(row.id);
    const sourceRowNumber = z.number().int().positive().safeParse(row.sourceRowNumber);
    const q2FeatureCodes = z.array(featureCodeSchema).safeParse(row.q2FeatureCodes);
    const q3FeatureCode = z
      .union([featureCodeSchema, z.null()])
      .safeParse(row.q3FeatureCode);

    if (
      !id.success ||
      !sourceRowNumber.success ||
      !q2FeatureCodes.success ||
      !q3FeatureCode.success
    ) {
      throw new AnalysisContractError(
        "invalid_source_data",
        "The normalized survey data is not structurally valid.",
      );
    }

    const texts = readTexts(row.normalizedTexts);
    if (texts.length === 0) {
      return [];
    }

    return [
      {
        response_id: id.data,
        source_row_number: sourceRowNumber.data,
        q2_feature_codes: q2FeatureCodes.data,
        q3_feature_code: q3FeatureCode.data,
        texts,
      },
    ];
  });

  if (responses.length === 0) {
    throw new AnalysisContractError(
      "no_eligible_feedback",
      "The current import has no accepted feedback text to analyze.",
    );
  }

  if (responses.length > ANALYSIS_LIMITS.maxResponses) {
    throw new AnalysisContractError(
      "analysis_row_limit",
      `Analysis is limited to ${ANALYSIS_LIMITS.maxResponses} feedback responses per run.`,
    );
  }

  const prompt = JSON.stringify({
    contract_version: ANALYSIS_VERSION,
    feature_codes: {
      1: "myDisplay",
      2: "myLock",
      3: "Find my Glo",
      4: "mySession",
      5: "myUsage",
      6: "Other",
    },
    responses,
  });

  if (prompt.length > ANALYSIS_LIMITS.maxInputCharacters) {
    throw new AnalysisContractError(
      "analysis_input_limit",
      `Analysis input exceeds the ${ANALYSIS_LIMITS.maxInputCharacters.toLocaleString("en-US")} character limit.`,
    );
  }

  return { prompt, responses };
}

function assertUnique(values: string[], message: string) {
  if (new Set(values).size !== values.length) {
    throw new AnalysisContractError("invalid_ai_output", message);
  }
}

export function validateAnalysisOutput(
  candidate: unknown,
  sourceResponses: AnalysisInputResponse[],
): AnalysisOutput {
  const parsed = analysisOutputBusinessSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AnalysisContractError(
      "invalid_ai_output",
      "The AI response did not satisfy the analysis contract.",
    );
  }

  const result = parsed.data;
  const sourceIds = new Set(sourceResponses.map((response) => response.response_id));
  const analysisIds = result.analyses.map((analysis) => analysis.response_id);
  assertUnique(analysisIds, "The AI response contains duplicate analyses.");

  if (
    analysisIds.length !== sourceIds.size ||
    analysisIds.some((responseId) => !sourceIds.has(responseId))
  ) {
    throw new AnalysisContractError(
      "invalid_ai_output",
      "The AI response does not analyze every eligible response exactly once.",
    );
  }

  const groupKeys = result.groups.map((group) => group.group_key);
  assertUnique(groupKeys, "The AI response contains duplicate group keys.");
  const groupKeySet = new Set(groupKeys);
  const groupedIds = result.groups.flatMap((group) => group.response_ids);
  assertUnique(groupedIds, "A response was assigned to more than one group.");

  if (
    groupedIds.length !== sourceIds.size ||
    groupedIds.some((responseId) => !sourceIds.has(responseId))
  ) {
    throw new AnalysisContractError(
      "invalid_ai_output",
      "Every analyzed response must belong to exactly one valid group.",
    );
  }

  const cardGroupKeys = result.cards.map((card) => card.group_key);
  assertUnique(cardGroupKeys, "The AI response contains duplicate cards.");
  if (
    cardGroupKeys.length !== groupKeys.length ||
    cardGroupKeys.some((groupKey) => !groupKeySet.has(groupKey))
  ) {
    throw new AnalysisContractError(
      "invalid_ai_output",
      "Every feedback group must have exactly one Opportunity Card.",
    );
  }

  const sourceById = new Map(
    sourceResponses.map((response) => [response.response_id, response]),
  );
  const groupMembers = new Map(
    result.groups.map((group) => [group.group_key, new Set(group.response_ids)]),
  );

  for (const card of result.cards) {
    const members = groupMembers.get(card.group_key);
    for (const evidence of card.evidence) {
      const source = sourceById.get(evidence.response_id);
      const sourceHasField = source?.texts.some(
        (text) => text.field === evidence.text_field,
      );
      if (!members?.has(evidence.response_id) || !sourceHasField) {
        throw new AnalysisContractError(
          "invalid_ai_output",
          "Opportunity Card evidence must reference an available source field from its group.",
        );
      }
    }
  }

  return {
    ...result,
    cards: result.cards.map((card) => {
      const seenResponseIds = new Set<string>();

      return {
        ...card,
        evidence: card.evidence.filter((evidence) => {
          if (seenResponseIds.has(evidence.response_id)) {
            return false;
          }

          seenResponseIds.add(evidence.response_id);
          return true;
        }),
      };
    }),
  };
}

export function toPersistencePayload(
  output: AnalysisOutput,
  sourceResponses: AnalysisInputResponse[],
): AnalysisPersistencePayload {
  const sourceById = new Map(
    sourceResponses.map((response) => [response.response_id, response]),
  );

  return {
    analyses: output.analyses,
    groups: output.groups,
    cards: output.cards.map((card) => ({
      group_key: card.group_key,
      user_need: card.user_need,
      potential_solution: card.potential_solution,
      research_questions: card.research_questions,
      evidence: card.evidence.map((evidence) => {
        if (!sourceById.has(evidence.response_id)) {
          throw new AnalysisContractError(
            "invalid_ai_output",
            "Opportunity Card evidence could not be resolved safely.",
          );
        }

        return {
          response_id: evidence.response_id,
          text_field: evidence.text_field,
        };
      }),
    })),
  };
}
