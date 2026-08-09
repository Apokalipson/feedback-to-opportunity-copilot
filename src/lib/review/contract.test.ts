import { describe, expect, it } from "vitest";
import { reviewMutationSchema } from "@/lib/review/contract";

const validReview = {
  importId: "20000000-0000-4000-8000-000000000001",
  cardId: "40000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-08-09T12:00:00.000Z",
  userNeed: "  Users need clear recovery guidance.  ",
  potentialSolution: "  Explore a guided recovery state.  ",
  researchQuestions: ["  Which interruption states create confusion?  "],
  reviewStatus: "approved",
  reviewNote: "  Confirmed against synthetic evidence.  ",
};

describe("Opportunity Card review contract", () => {
  it("trims bounded editable fields", () => {
    const result = reviewMutationSchema.parse(validReview);

    expect(result.userNeed).toBe("Users need clear recovery guidance.");
    expect(result.potentialSolution).toBe(
      "Explore a guided recovery state.",
    );
    expect(result.researchQuestions).toEqual([
      "Which interruption states create confusion?",
    ]);
    expect(result.reviewNote).toBe("Confirmed against synthetic evidence.");
  });

  it("rejects duplicated research questions case-insensitively", () => {
    const result = reviewMutationSchema.safeParse({
      ...validReview,
      researchQuestions: ["What failed?", "what failed?"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an expanded payload and invalid status", () => {
    const result = reviewMutationSchema.safeParse({
      ...validReview,
      reviewStatus: "published",
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});
