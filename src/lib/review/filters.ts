import type {
  OpportunityReviewCard,
  ReviewResponseItem,
  ReviewStatus,
} from "@/lib/review/types";

export type ResponseFilters = {
  query: string;
  validationStatus: string;
  topic: string;
  sentiment: string;
  productArea: string;
};

export type CardFilters = {
  query: string;
  reviewStatus: ReviewStatus | "all";
};

function includesQuery(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) =>
    value?.toLocaleLowerCase("en-US").includes(normalizedQuery),
  );
}

export function filterResponses(
  responses: ReviewResponseItem[],
  filters: ResponseFilters,
) {
  return responses.filter((response) => {
    if (
      filters.validationStatus !== "all" &&
      response.validationStatus !== filters.validationStatus
    ) {
      return false;
    }
    if (filters.topic !== "all" && response.analysis?.topic !== filters.topic) {
      return false;
    }
    if (
      filters.sentiment !== "all" &&
      response.analysis?.sentiment !== filters.sentiment
    ) {
      return false;
    }
    if (
      filters.productArea !== "all" &&
      response.analysis?.productArea !== filters.productArea
    ) {
      return false;
    }

    return includesQuery(
      [
        `row ${response.sourceRowNumber}`,
        response.analysis?.topic,
        response.analysis?.sentiment,
        response.analysis?.productArea,
        response.analysis?.userProblem,
        ...response.texts.map((text) => text.value),
      ],
      filters.query,
    );
  });
}
export function filterCards(cards: OpportunityReviewCard[], filters: CardFilters) {
  return cards.filter((card) => {
    if (filters.reviewStatus !== "all" && card.reviewStatus !== filters.reviewStatus) {
      return false;
    }

    return includesQuery(
      [
        card.groupLabel,
        card.groupSummary,
        card.userNeed,
        card.potentialSolution,
        ...card.researchQuestions,
        ...card.evidence.map((evidence) => evidence.quote),
      ],
      filters.query,
    );
  });
}
