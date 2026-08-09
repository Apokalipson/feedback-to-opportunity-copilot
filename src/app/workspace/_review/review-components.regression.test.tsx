import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { OpportunityCardEditor } from "./opportunity-card-editor";
import { stableTimestamp } from "./review-ui";
import type { OpportunityReviewCard } from "@/lib/review/types";

function syntheticCard(
  overrides: Partial<OpportunityReviewCard> = {},
): OpportunityReviewCard {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    importId: "20000000-0000-4000-8000-000000000001",
    groupLabel: "Recovery guidance",
    groupSummary: "Users need clear recovery steps.",
    scaleCount: 0,
    scalePercentage: 0,
    userNeed: "Users need a clear recovery path.",
    potentialSolution: "Explore a guided recovery state.",
    researchQuestions: ["Which interruption states are most confusing?"],
    reviewStatus: "approved",
    aiGenerated: true,
    analysisVersion: "analysis-v1",
    updatedAt: "not-a-timestamp",
    evidence: [],
    history: [],
    ...overrides,
  };
}

function renderCard(overrides: Partial<OpportunityReviewCard> = {}) {
  return renderToStaticMarkup(
    <OpportunityCardEditor card={syntheticCard(overrides)} totalRows={0} />,
  );
}

describe("Review component regression contract", () => {
  it("renders zero scale, invalid timestamps, empty history, and AI origin safely", () => {
    const html = renderCard();

    expect(html).toContain("0 responses · 0.0% of current import");
    expect(html).toContain("Scale denominator: all 0 rows");
    expect(html).toContain("Updated Unknown time");
    expect(html).toContain("Review history (0)");
    expect(html).toContain("No human review has been recorded yet.");
    expect(html).toContain("Approved");
    expect(html).toContain("AI-generated origin");
  });

  it("escapes untrusted visible text instead of interpreting markup", () => {
    const injection = '<img src=x onerror="alert(1)">';
    const html = renderCard({
      groupLabel: injection,
      groupSummary: injection,
      userNeed: injection,
      potentialSolution: injection,
      researchQuestions: [injection],
      evidence: [{ sourceRowNumber: 9, quote: injection }],
      history: [
        {
          id: "event-1",
          previousStatus: "pending",
          newStatus: "approved",
          editedFields: [injection],
          reviewNote: injection,
          createdAt: "not-a-timestamp",
        },
      ],
    });

    expect(html).not.toContain(injection);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("keeps native labels, field grouping, button types, and live feedback", () => {
    const html = renderCard({
      researchQuestions: ["First synthetic question?", "Second synthetic question?"],
    });

    expect(html).toContain("<label");
    expect(html).toContain("User need");
    expect(html).toContain("Potential solution");
    expect(html).toContain("<fieldset>");
    expect(html).toContain("<legend");
    expect(html).toContain("Research questions");
    expect(html).toContain('aria-label="Remove research question 1"');
    expect(html).toContain('type="button"');
    expect(html.match(/type="submit"/g)).toHaveLength(3);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("maxLength=\"1000\"");
    expect(html).toContain("maxLength=\"1500\"");
    expect(html).toContain("maxLength=\"500\"");
  });

  it("uses a timestamp-sensitive editor key so refreshed cards remount", () => {
    const source = readFileSync(
      new URL("./opportunity-review.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("key={`${card.id}:${card.updatedAt}`}");
  });

  it("constructs the frozen PATCH payload without evidence or raw data", () => {
    const source = readFileSync(
      new URL("./opportunity-card-editor.tsx", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("body: JSON.stringify({");
    const end = source.indexOf("}),", start);
    const payload = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    for (const field of [
      "importId",
      "cardId",
      "expectedUpdatedAt",
      "userNeed",
      "potentialSolution",
      "researchQuestions",
      "reviewStatus",
      "reviewNote",
    ]) {
      expect(payload).toContain(field);
    }
    expect(payload).not.toMatch(/evidence|quote|rawPayload|respondent/i);
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('"content-type": "application/json"');
  });

  it("keeps server-only data modules out of the client component graph", () => {
    const files = [
      "review-ui.tsx",
      "response-explorer.tsx",
      "opportunity-review.tsx",
      "opportunity-card-editor.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/server-only|@\/lib\/data\//);
    }
  });

  it(
    "gives an explicit empty state when a card has no source evidence",
    () => {
      const html = renderCard({ evidence: [] });

      expect(html).toMatch(/No source evidence is available/i);
    },
  );
});

describe("Shared presentation helper regressions", () => {
  it("formats valid UTC values deterministically and rejects invalid values", () => {
    expect(stableTimestamp("2026-08-09T12:34:56.000Z")).toBe(
      "2026-08-09 12:34 UTC",
    );
    expect(stableTimestamp("not-a-timestamp")).toBe("Unknown time");
  });
});
