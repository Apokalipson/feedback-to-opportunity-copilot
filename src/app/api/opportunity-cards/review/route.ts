import { getImportActor } from "@/lib/data/imports";
import { persistOpportunityReview } from "@/lib/data/review";
import { createReviewPatchHandler } from "@/lib/review/route-handler";

export const runtime = "nodejs";

export const PATCH = createReviewPatchHandler({
  getActor: getImportActor,
  saveReview: persistOpportunityReview,
});
