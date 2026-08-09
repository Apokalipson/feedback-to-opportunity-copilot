import "server-only";

import {
  ANALYSIS_VERSION,
  toPersistencePayload,
  validateAnalysisOutput,
} from "@/lib/analysis/contract";
import { requestStructuredAnalysis } from "@/lib/analysis/openai";
import type { ImportActor } from "@/lib/data/imports";
import {
  loadCurrentImportAnalysisInput,
  replacePersistedAnalysis,
} from "@/lib/data/analysis";

export async function analyzeCurrentImport(
  actor: ImportActor,
  importId: string,
) {
  const input = await loadCurrentImportAnalysisInput(actor, importId);
  const providerResult = await requestStructuredAnalysis(input, actor.userId);
  const output = validateAnalysisOutput(providerResult.output, input.responses);
  const payload = toPersistencePayload(output, input.responses);
  const persisted = await replacePersistedAnalysis(
    actor,
    importId,
    providerResult.model,
    ANALYSIS_VERSION,
    payload,
  );

  return {
    importId,
    model: providerResult.model,
    version: ANALYSIS_VERSION,
    analyzedResponses: persisted.analyses,
    groups: persisted.groups,
    cards: persisted.cards,
    evidenceLinks: persisted.evidence,
    usage: providerResult.usage,
  };
}
