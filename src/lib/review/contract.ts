import { z } from "zod";

export const REVIEW_LIMITS = {
  maxRequestBytes: 16 * 1024,
  maxUserNeedCharacters: 1000,
  maxPotentialSolutionCharacters: 1500,
  maxResearchQuestions: 4,
  maxResearchQuestionCharacters: 500,
  maxReviewNoteCharacters: 1000,
} as const;

export const reviewStatuses = ["pending", "approved", "rejected"] as const;

const boundedText = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

export const reviewMutationSchema = z
  .object({
    importId: z.string().uuid(),
    cardId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    userNeed: boundedText(REVIEW_LIMITS.maxUserNeedCharacters),
    potentialSolution: boundedText(
      REVIEW_LIMITS.maxPotentialSolutionCharacters,
    ),
    researchQuestions: z
      .array(boundedText(REVIEW_LIMITS.maxResearchQuestionCharacters))
      .min(1)
      .max(REVIEW_LIMITS.maxResearchQuestions),
    reviewStatus: z.enum(reviewStatuses),
    reviewNote: z
      .string()
      .trim()
      .max(REVIEW_LIMITS.maxReviewNoteCharacters)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const normalizedQuestions = value.researchQuestions.map((question) =>
      question.toLocaleLowerCase("en-US"),
    );

    if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
      context.addIssue({
        code: "custom",
        message: "Research questions must be unique.",
        path: ["researchQuestions"],
      });
    }
  });

export type ReviewMutationInput = z.infer<typeof reviewMutationSchema>;
