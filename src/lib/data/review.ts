import "server-only";

import { TEXT_FIELD_HEADERS } from "@/lib/imports/contract";
import { createClient } from "@/lib/supabase/server";
import type {
  OpportunityReviewCard,
  ReviewResponseItem,
  ReviewStatus,
  ReviewWorkspaceData,
} from "@/lib/review/types";
import type { ImportActor } from "@/lib/data/imports";
import type { Json } from "@/types/database";

const TEXT_FIELD_LABELS: Record<string, string> = {
  q1b_csat_comment: "CSAT follow-up 1",
  q1c_csat_comment: "CSAT follow-up 2",
  q1d_csat_comment: "CSAT follow-up 3",
  q2_other_text: "Other feature used",
  q3_other_text: "Other valuable feature",
  q3b_feature_comment: "Feature feedback",
  q4b_ces_comment: "Effort feedback",
  q5_comment: "Open feedback",
};

const allowedTextFields = new Set(Object.keys(TEXT_FIELD_HEADERS));

export class ReviewDataError extends Error {
  constructor(
    public readonly code:
      | "review_unavailable"
      | "stale_review"
      | "no_changes"
      | "review_invalid",
    message: string,
  ) {
    super(message);
    this.name = "ReviewDataError";
  }
}

function safeTextEntries(value: Json): ReviewResponseItem["texts"] {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([field, fieldValue]) => {
    if (
      !allowedTextFields.has(field) ||
      typeof fieldValue !== "string" ||
      !fieldValue.trim()
    ) {
      return [];
    }

    return [
      {
        field,
        label: TEXT_FIELD_LABELS[field] ?? field,
        value: fieldValue.trim(),
      },
    ];
  });
}

function safeIssueCodes(value: Json) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((issue) => {
    if (
      issue &&
      !Array.isArray(issue) &&
      typeof issue === "object" &&
      typeof issue.code === "string"
    ) {
      return [issue.code];
    }
    return [];
  });
}

function safeEditedFields(value: Json) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return [];
  }

  return Object.entries(value)
    .filter(([, edited]) => edited === true)
    .map(([field]) => field);
}

export async function loadReviewWorkspace(
  userId: string,
  importId: string,
  totalRows: number,
): Promise<ReviewWorkspaceData> {
  const supabase = await createClient();
  const [responsesResult, analysesResult, groupsResult, membershipsResult, cardsResult, evidenceResult, historyResult] =
    await Promise.all([
      supabase
        .from("survey_responses")
        .select(
          "id, source_row_number, normalized_texts, q2_feature_codes, q3_feature_code, validation_status, validation_issues",
        )
        .eq("owner_id", userId)
        .eq("import_id", importId)
        .order("source_row_number"),
      supabase
        .from("response_analyses")
        .select(
          "response_id, topic, user_problem, sentiment, product_area, confidence",
        )
        .eq("owner_id", userId)
        .eq("import_id", importId),
      supabase
        .from("feedback_groups")
        .select("id, label, summary")
        .eq("owner_id", userId)
        .eq("import_id", importId),
      supabase
        .from("group_memberships")
        .select("group_id, response_id")
        .eq("owner_id", userId)
        .eq("import_id", importId),
      supabase
        .from("opportunity_cards")
        .select(
          "id, group_id, user_need, potential_solution, research_questions, review_status, ai_generated, analysis_version, updated_at",
        )
        .eq("owner_id", userId)
        .eq("import_id", importId)
        .order("created_at"),
      supabase
        .from("opportunity_evidence")
        .select("card_id, response_id, representative_quote")
        .eq("owner_id", userId)
        .eq("import_id", importId),
      supabase
        .from("opportunity_review_history")
        .select(
          "id, card_id, previous_status, new_status, edited_fields, review_note, created_at",
        )
        .eq("owner_id", userId)
        .eq("import_id", importId)
        .order("created_at", { ascending: false }),
    ]);

  if (
    responsesResult.error ||
    analysesResult.error ||
    groupsResult.error ||
    membershipsResult.error ||
    cardsResult.error ||
    evidenceResult.error ||
    historyResult.error
  ) {
    throw new ReviewDataError(
      "review_unavailable",
      "The current-import review workspace could not be loaded.",
    );
  }

  const analysesByResponse = new Map(
    (analysesResult.data ?? []).map((analysis) => [analysis.response_id, analysis]),
  );
  const sourceRowsByResponse = new Map(
    (responsesResult.data ?? []).map((response) => [
      response.id,
      response.source_row_number,
    ]),
  );
  const groupsById = new Map(
    (groupsResult.data ?? []).map((group) => [group.id, group]),
  );
  const membershipCountByGroup = new Map<string, number>();
  for (const membership of membershipsResult.data ?? []) {
    membershipCountByGroup.set(
      membership.group_id,
      (membershipCountByGroup.get(membership.group_id) ?? 0) + 1,
    );
  }

  const responses: ReviewResponseItem[] = (responsesResult.data ?? []).map(
    (response) => {
      const analysis = analysesByResponse.get(response.id);
      return {
        sourceRowNumber: response.source_row_number,
        validationStatus: response.validation_status,
        texts: safeTextEntries(response.normalized_texts),
        q2FeatureCodes: response.q2_feature_codes,
        q3FeatureCode: response.q3_feature_code,
        issueCodes: safeIssueCodes(response.validation_issues),
        analysis:
          analysis &&
          analysis.topic &&
          analysis.user_problem &&
          analysis.sentiment &&
          analysis.product_area
            ? {
                topic: analysis.topic,
                userProblem: analysis.user_problem,
                sentiment: analysis.sentiment,
                productArea: analysis.product_area,
                confidence: analysis.confidence,
              }
            : null,
      };
    },
  );

  const cards: OpportunityReviewCard[] = (cardsResult.data ?? []).flatMap(
    (card) => {
      if (!card.group_id) {
        return [];
      }
      const group = groupsById.get(card.group_id);
      if (!group) {
        return [];
      }
      const scaleCount = membershipCountByGroup.get(card.group_id) ?? 0;
      return [
        {
          id: card.id,
          importId,
          groupLabel: group.label,
          groupSummary: group.summary ?? "No group summary was generated.",
          scaleCount,
          scalePercentage: totalRows > 0 ? (scaleCount / totalRows) * 100 : 0,
          userNeed: card.user_need,
          potentialSolution: card.potential_solution ?? "",
          researchQuestions: card.research_questions,
          reviewStatus: card.review_status,
          aiGenerated: card.ai_generated,
          analysisVersion: card.analysis_version,
          updatedAt: card.updated_at,
          evidence: (evidenceResult.data ?? [])
            .filter((evidence) => evidence.card_id === card.id)
            .map((evidence) => ({
              sourceRowNumber:
                sourceRowsByResponse.get(evidence.response_id) ?? 0,
              quote: evidence.representative_quote,
            })),
          history: (historyResult.data ?? [])
            .filter((event) => event.card_id === card.id)
            .map((event) => ({
              id: event.id,
              previousStatus: event.previous_status,
              newStatus: event.new_status,
              editedFields: safeEditedFields(event.edited_fields),
              reviewNote: event.review_note,
              createdAt: event.created_at,
            })),
        },
      ];
    },
  );

  return { totalRows, responses, cards };
}

export async function persistOpportunityReview(
  actor: ImportActor,
  input: {
    importId: string;
    cardId: string;
    expectedUpdatedAt: string;
    userNeed: string;
    potentialSolution: string;
    researchQuestions: string[];
    reviewStatus: ReviewStatus;
    reviewNote: string | null;
  },
) {
  const { data, error } = await actor.supabase.rpc(
    "review_current_opportunity_card",
    {
      p_import_id: input.importId,
      p_card_id: input.cardId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_user_need: input.userNeed,
      p_potential_solution: input.potentialSolution,
      p_research_questions: input.researchQuestions,
      p_review_status: input.reviewStatus,
      p_review_note: input.reviewNote,
    },
  );

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    const message = error?.message ?? "";
    if (message.includes("review_stale")) {
      throw new ReviewDataError(
        "stale_review",
        "This card changed after it was loaded. Refresh and review the latest version.",
      );
    }
    if (message.includes("review_no_changes")) {
      throw new ReviewDataError(
        "no_changes",
        "Change the card, status, or review note before saving.",
      );
    }
    if (message.includes("review_card_not_available")) {
      throw new ReviewDataError(
        "review_unavailable",
        "This card is not available in the current import.",
      );
    }
    if (message.includes("review_")) {
      throw new ReviewDataError(
        "review_invalid",
        "The review did not satisfy the card contract.",
      );
    }
    throw new ReviewDataError(
      "review_unavailable",
      "The Opportunity Card review could not be saved safely.",
    );
  }

  const result = data as Record<string, Json | undefined>;
  if (
    typeof result.card_id !== "string" ||
    !["pending", "approved", "rejected"].includes(
      String(result.review_status),
    ) ||
    typeof result.updated_at !== "string"
  ) {
    throw new ReviewDataError(
      "review_unavailable",
      "The review result could not be verified.",
    );
  }

  return {
    cardId: result.card_id,
    reviewStatus: result.review_status as ReviewStatus,
    updatedAt: result.updated_at,
  } satisfies {
    cardId: string;
    reviewStatus: ReviewStatus;
    updatedAt: string;
  };
}
