import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ReviewDataError } from "@/lib/data/review";
import type { ImportActor } from "@/lib/data/imports";
import { createReviewPatchHandler } from "@/lib/review/route-handler";

const actor = {
  userId: "10000000-0000-4000-8000-000000000001",
  supabase: {},
} as unknown as ImportActor;

const importId = "20000000-0000-4000-8000-000000000001";
const cardId = "40000000-0000-4000-8000-000000000001";
const updatedAt = "2026-08-09T12:00:00.000Z";

const validBody = {
  importId,
  cardId,
  expectedUpdatedAt: updatedAt,
  userNeed: "Users need a clear recovery path.",
  potentialSolution: "Explore a guided recovery state.",
  researchQuestions: ["Which interruption states are most confusing?"],
  reviewStatus: "approved",
  reviewNote: "Validated against the synthetic evidence.",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/opportunity-cards/review", {
    method: "PATCH",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/opportunity-cards/review", () => {
  const saveReview = vi.fn();

  beforeEach(() => {
    saveReview.mockReset();
    saveReview.mockResolvedValue({
      cardId,
      reviewStatus: "approved",
      updatedAt: "2026-08-09T12:05:00.000Z",
    });
  });

  it("rejects a cross-origin review before doing work", async () => {
    const handler = createReviewPatchHandler({
      getActor: async () => actor,
      saveReview,
    });
    const response = await handler(
      request(validBody, { origin: "https://untrusted.example" }),
    );

    expect(response.status).toBe(403);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated review", async () => {
    const handler = createReviewPatchHandler({
      getActor: async () => null,
      saveReview,
    });
    const response = await handler(request(validBody));

    expect(response.status).toBe(401);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects an invalid review body", async () => {
    const handler = createReviewPatchHandler({
      getActor: async () => actor,
      saveReview,
    });
    const response = await handler(
      request({ ...validBody, researchQuestions: [] }),
    );

    expect(response.status).toBe(400);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body without relying on content length", async () => {
    const handler = createReviewPatchHandler({
      getActor: async () => actor,
      saveReview,
    });
    const response = await handler(
      request({
        ...validBody,
        unexpectedPadding: "x".repeat(17 * 1024),
      }),
    );

    expect(response.status).toBe(413);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("maps stale writes to a conflict without echoing card content", async () => {
    saveReview.mockRejectedValue(
      new ReviewDataError(
        "stale_review",
        "This card changed after it was loaded. Refresh and review the latest version.",
      ),
    );
    const handler = createReviewPatchHandler({
      getActor: async () => actor,
      saveReview,
    });
    const response = await handler(request(validBody));
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result).toMatchObject({ ok: false, code: "stale_review" });
    expect(JSON.stringify(result)).not.toContain(validBody.userNeed);
  });

  it("returns only the persisted review identity and status", async () => {
    const handler = createReviewPatchHandler({
      getActor: async () => actor,
      saveReview,
    });
    const response = await handler(request(validBody));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      cardId,
      reviewStatus: "approved",
      updatedAt: "2026-08-09T12:05:00.000Z",
    });
    expect(saveReview).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        userNeed: validBody.userNeed,
        reviewStatus: "approved",
      }),
    );
  });
});
