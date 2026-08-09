import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAnalysisPostHandler } from "@/lib/analysis/route-handler";
import type { ImportActor } from "@/lib/data/imports";

const actor = {
  userId: "10000000-0000-4000-8000-000000000001",
  supabase: {},
} as unknown as ImportActor;

const importId = "20000000-0000-4000-8000-000000000001";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/analysis", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analysis", () => {
  const analyze = vi.fn();

  beforeEach(() => {
    analyze.mockReset();
    analyze.mockResolvedValue({
      importId,
      model: "gpt-5.6-luna",
      version: "analysis-v1",
      analyzedResponses: 2,
      groups: 1,
      cards: 1,
      evidenceLinks: 1,
      usage: { inputTokens: 300, outputTokens: 150, totalTokens: 450 },
    });
  });

  it("rejects a cross-origin request before doing work", async () => {
    const handler = createAnalysisPostHandler({
      getActor: async () => actor,
      analyze,
    });
    const response = await handler(
      request({ importId }, { origin: "https://untrusted.example" }),
    );

    expect(response.status).toBe(403);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    const handler = createAnalysisPostHandler({
      getActor: async () => null,
      analyze,
    });
    const response = await handler(request({ importId }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expanded request body", async () => {
    const handler = createAnalysisPostHandler({
      getActor: async () => actor,
      analyze,
    });
    const response = await handler(
      request({ importId: "not-a-uuid", unexpected: true }),
    );

    expect(response.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns only a redacted summary after a valid analysis", async () => {
    const handler = createAnalysisPostHandler({
      getActor: async () => actor,
      analyze,
    });
    const response = await handler(request({ importId }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result).toEqual({
      ok: true,
      importId,
      model: "gpt-5.6-luna",
      version: "analysis-v1",
      analyzedResponses: 2,
      groups: 1,
      cards: 1,
      evidenceLinks: 1,
      usage: { inputTokens: 300, outputTokens: 150, totalTokens: 450 },
    });
    expect(JSON.stringify(result)).not.toContain("feedback");
    expect(analyze).toHaveBeenCalledWith(actor, importId);
  });
});
