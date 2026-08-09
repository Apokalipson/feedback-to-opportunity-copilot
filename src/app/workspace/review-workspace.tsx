import { OpportunityReview } from "@/app/workspace/_review/opportunity-review";
import { ResponseExplorer } from "@/app/workspace/_review/response-explorer";
import type { ReviewWorkspaceData } from "@/lib/review/types";

export function ReviewWorkspace({ data }: { data: ReviewWorkspaceData }) {
  return (
    <>
      <ResponseExplorer data={data} />
      <OpportunityReview data={data} />
    </>
  );
}
