import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { persistOpportunityReview } from "@/lib/data/review";
import type { ImportActor } from "@/lib/data/imports";

const input = {
  importId: "20000000-0000-4000-8000-000000000001",
  cardId: "40000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-08-09T12:00:00.000Z",
  userNeed: "Users need a clear recovery path.",
  potentialSolution: "Explore a guided recovery state.",
  researchQuestions: ["Which interruption states are most confusing?"],
  reviewStatus: "approved" as const,
  reviewNote: null,
};

function actorWithResult(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    actor: {
      userId: "10000000-0000-4000-8000-000000000001",
      supabase: { rpc },
    } as unknown as ImportActor,
    rpc,
  };
}

describe("Review persistence adapter boundary", () => {
  it("uses only the atomic review RPC and forwards optimistic concurrency", async () => {
    const { actor, rpc } = actorWithResult({
      data: {
        card_id: input.cardId,
        review_status: "approved",
        updated_at: "2026-08-09T12:01:00.000Z",
      },
      error: null,
    });

    await expect(persistOpportunityReview(actor, input)).resolves.toEqual({
      cardId: input.cardId,
      reviewStatus: "approved",
      updatedAt: "2026-08-09T12:01:00.000Z",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("review_current_opportunity_card", {
      p_import_id: input.importId,
      p_card_id: input.cardId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_user_need: input.userNeed,
      p_potential_solution: input.potentialSolution,
      p_research_questions: input.researchQuestions,
      p_review_status: input.reviewStatus,
      p_review_note: input.reviewNote,
    });
  });

  it.each([
    [
      "review_stale",
      "stale_review",
      "This card changed after it was loaded. Refresh and review the latest version.",
    ],
    [
      "review_no_changes",
      "no_changes",
      "Change the card, status, or review note before saving.",
    ],
    [
      "review_card_not_available",
      "review_unavailable",
      "This card is not available in the current import.",
    ],
    [
      "review_contract_failed",
      "review_invalid",
      "The review did not satisfy the card contract.",
    ],
  ])("maps database marker %s without exposing its detail", async (marker, code, message) => {
    const { actor } = actorWithResult({
      data: null,
      error: { message: `${marker}: private database context` },
    });

    const promise = persistOpportunityReview(actor, input);
    await expect(promise).rejects.toMatchObject({
      name: "ReviewDataError",
      code,
      message,
    });
  });

  it("rejects an unverifiable RPC response", async () => {
    const { actor } = actorWithResult({
      data: {
        card_id: input.cardId,
        review_status: "approved",
      },
      error: null,
    });

    await expect(persistOpportunityReview(actor, input)).rejects.toMatchObject({
      code: "review_unavailable",
      message: "The review result could not be verified.",
    });
  });
});
