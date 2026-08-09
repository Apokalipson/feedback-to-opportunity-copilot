import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ReviewDataError } from "@/lib/data/review";
import type { ImportActor } from "@/lib/data/imports";
import { REVIEW_LIMITS } from "@/lib/review/contract";
import { createReviewPatchHandler } from "@/lib/review/route-handler";

const actor = {
  userId: "10000000-0000-4000-8000-000000000001",
  supabase: {},
} as unknown as ImportActor;

const validBody = {
  importId: "20000000-0000-4000-8000-000000000001",
  cardId: "40000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-08-09T12:00:00.000Z",
  userNeed: "  Users need a clear recovery path.  ",
  potentialSolution: "  Explore a guided recovery state.  ",
  researchQuestions: ["  Which interruptions cause confusion?  "],
  reviewStatus: "approved",
  reviewNote: "   ",
};

function jsonRequest(
  body: unknown,
  headers: Record<string, string> = {},
) {
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

describe("PATCH review route security boundary", () => {
  const getActor = vi.fn<() => Promise<ImportActor | null>>();
  const saveReview = vi.fn();

  beforeEach(() => {
    getActor.mockReset();
    getActor.mockResolvedValue(actor);
    saveReview.mockReset();
    saveReview.mockResolvedValue({
      cardId: validBody.cardId,
      reviewStatus: "approved",
      updatedAt: "2026-08-09T12:01:00.000Z",
    });
  });

  it("passes only normalized contract fields to persistence", async () => {
    const handler = createReviewPatchHandler({ getActor, saveReview });
    const response = await handler(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(saveReview).toHaveBeenCalledWith(actor, {
      importId: validBody.importId,
      cardId: validBody.cardId,
      expectedUpdatedAt: validBody.expectedUpdatedAt,
      userNeed: "Users need a clear recovery path.",
      potentialSolution: "Explore a guided recovery state.",
      researchQuestions: ["Which interruptions cause confusion?"],
      reviewStatus: "approved",
      reviewNote: "",
    });
  });

  it("rejects evidence and raw respondent payload before persistence", async () => {
    const handler = createReviewPatchHandler({ getActor, saveReview });

    for (const forbidden of [
      { evidence: [{ quote: "Browser supplied quote" }] },
      { representativeQuote: "Browser supplied quote" },
      { rawPayload: { respondent: "private" } },
    ]) {
      const response = await handler(
        jsonRequest({ ...validBody, ...forbidden }),
      );
      expect(response.status).toBe(400);
    }

    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects unsupported media, malformed JSON, and invalid UTF-8", async () => {
    const handler = createReviewPatchHandler({ getActor, saveReview });
    const textResponse = await handler(
      jsonRequest(validBody, { "content-type": "text/plain" }),
    );
    const malformedResponse = await handler(
      new Request("http://localhost:3000/api/opportunity-cards/review", {
        method: "PATCH",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    const invalidUtf8Response = await handler(
      new Request("http://localhost:3000/api/opportunity-cards/review", {
        method: "PATCH",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: new Uint8Array([0xc3, 0x28]),
      }),
    );

    expect(textResponse.status).toBe(415);
    expect(malformedResponse.status).toBe(400);
    expect(invalidUtf8Response.status).toBe(400);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized request before authentication", async () => {
    const handler = createReviewPatchHandler({ getActor, saveReview });
    const response = await handler(
      jsonRequest(validBody, {
        "content-length": String(REVIEW_LIMITS.maxRequestBytes + 1),
      }),
    );

    expect(response.status).toBe(413);
    expect(getActor).not.toHaveBeenCalled();
    expect(saveReview).not.toHaveBeenCalled();
  });

  it.each([
    ["stale_review", 409],
    ["review_unavailable", 409],
    ["no_changes", 422],
    ["review_invalid", 422],
  ] as const)("maps %s to status %i", async (code, status) => {
    saveReview.mockRejectedValue(new ReviewDataError(code, `Synthetic ${code}`));
    const handler = createReviewPatchHandler({ getActor, saveReview });
    const response = await handler(jsonRequest(validBody));
    const result = await response.json();

    expect(response.status).toBe(status);
    expect(result).toEqual({
      ok: false,
      code,
      message: `Synthetic ${code}`,
    });
  });

  it("converts an unexpected persistence failure to a bounded response", async () => {
    saveReview.mockRejectedValue(new Error("private database detail"));
    const handler = createReviewPatchHandler({ getActor, saveReview });
    const response = await handler(jsonRequest(validBody));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("review_failed");
    expect(text).not.toContain("private database detail");
    expect(text).not.toContain(validBody.userNeed.trim());
  });
});
