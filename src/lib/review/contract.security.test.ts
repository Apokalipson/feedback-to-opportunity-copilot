import { describe, expect, it } from "vitest";
import {
  REVIEW_LIMITS,
  reviewMutationSchema,
} from "@/lib/review/contract";

const validReview = {
  importId: "20000000-0000-4000-8000-000000000001",
  cardId: "40000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-08-09T12:00:00.000Z",
  userNeed: "Users need a clear recovery path.",
  potentialSolution: "Explore a guided recovery state.",
  researchQuestions: ["Which interruption states are most confusing?"],
  reviewStatus: "approved" as const,
  reviewNote: "Synthetic review note.",
};

describe("Review mutation contract security", () => {
  it("accepts exactly one through four non-blank research questions", () => {
    for (const count of [1, 2, 3, 4]) {
      const result = reviewMutationSchema.safeParse({
        ...validReview,
        researchQuestions: Array.from(
          { length: count },
          (_, index) => `Synthetic question ${index + 1}?`,
        ),
      });
      expect(result.success, `question count ${count}`).toBe(true);
    }

    for (const count of [0, 5]) {
      const result = reviewMutationSchema.safeParse({
        ...validReview,
        researchQuestions: Array.from(
          { length: count },
          (_, index) => `Synthetic question ${index + 1}?`,
        ),
      });
      expect(result.success, `question count ${count}`).toBe(false);
    }
  });

  it("accepts exact text limits and rejects one character beyond each limit", () => {
    const fields = [
      ["userNeed", REVIEW_LIMITS.maxUserNeedCharacters],
      ["potentialSolution", REVIEW_LIMITS.maxPotentialSolutionCharacters],
      ["reviewNote", REVIEW_LIMITS.maxReviewNoteCharacters],
    ] as const;

    for (const [field, maximum] of fields) {
      expect(
        reviewMutationSchema.safeParse({
          ...validReview,
          [field]: "x".repeat(maximum),
        }).success,
        `${field} at limit`,
      ).toBe(true);
      expect(
        reviewMutationSchema.safeParse({
          ...validReview,
          [field]: "x".repeat(maximum + 1),
        }).success,
        `${field} beyond limit`,
      ).toBe(false);
    }

    expect(
      reviewMutationSchema.safeParse({
        ...validReview,
        researchQuestions: [
          "x".repeat(REVIEW_LIMITS.maxResearchQuestionCharacters),
        ],
      }).success,
    ).toBe(true);
    expect(
      reviewMutationSchema.safeParse({
        ...validReview,
        researchQuestions: [
          "x".repeat(REVIEW_LIMITS.maxResearchQuestionCharacters + 1),
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects blank required values and blank research questions", () => {
    for (const field of ["userNeed", "potentialSolution"] as const) {
      expect(
        reviewMutationSchema.safeParse({ ...validReview, [field]: " \n\t " })
          .success,
      ).toBe(false);
    }

    expect(
      reviewMutationSchema.safeParse({
        ...validReview,
        researchQuestions: ["   "],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate questions after trimming and case folding", () => {
    const result = reviewMutationSchema.safeParse({
      ...validReview,
      researchQuestions: ["  What failed? ", "what FAILED?"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Research questions must be unique.",
            path: ["researchQuestions"],
          }),
        ]),
      );
    }
  });

  it("normalizes an empty review note to an empty string and accepts null", () => {
    const blank = reviewMutationSchema.parse({
      ...validReview,
      reviewNote: "  ",
    });
    const absent = reviewMutationSchema.parse({
      ...validReview,
      reviewNote: null,
    });

    expect(blank.reviewNote).toBe("");
    expect(absent.reviewNote).toBeNull();
  });

  it("rejects malformed identifiers, timestamps, statuses, and extra fields", () => {
    const invalidCases = [
      { ...validReview, importId: "not-a-uuid" },
      { ...validReview, cardId: "not-a-uuid" },
      { ...validReview, expectedUpdatedAt: "not-a-timestamp" },
      { ...validReview, reviewStatus: "published" },
      { ...validReview, evidence: [{ quote: "Browser supplied quote" }] },
      { ...validReview, rawPayload: { respondent: "private" } },
    ];

    for (const input of invalidCases) {
      expect(reviewMutationSchema.safeParse(input).success).toBe(false);
    }
  });
});
