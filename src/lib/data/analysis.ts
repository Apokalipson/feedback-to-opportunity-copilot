import "server-only";

import { z } from "zod";
import {
  prepareAnalysisInput,
  type AnalysisPersistencePayload,
  type PreparedAnalysisInput,
} from "@/lib/analysis/contract";
import type { ImportActor } from "@/lib/data/imports";
import type { Json } from "@/types/database";

const persistenceResultSchema = z.object({
  analyses: z.number().int().positive(),
  groups: z.number().int().positive(),
  cards: z.number().int().positive(),
  evidence: z.number().int().positive(),
});

export type AnalysisPersistenceSummary = z.infer<
  typeof persistenceResultSchema
>;

export class AnalysisDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisDataError";
  }
}

export async function loadCurrentImportAnalysisInput(
  actor: ImportActor,
  importId: string,
): Promise<PreparedAnalysisInput> {
  const { data: currentImport, error: importError } = await actor.supabase
    .from("imports")
    .select("id")
    .eq("id", importId)
    .eq("owner_id", actor.userId)
    .eq("is_current", true)
    .eq("status", "ready")
    .maybeSingle();

  if (importError) {
    throw new AnalysisDataError(
      "analysis_source_failed",
      "The current import could not be loaded for analysis.",
    );
  }

  if (!currentImport) {
    throw new AnalysisDataError(
      "import_not_current",
      "Choose the current ready import before starting analysis.",
    );
  }

  const { data: rows, error: rowsError } = await actor.supabase
    .from("survey_responses")
    .select(
      "id, source_row_number, normalized_texts, q2_feature_codes, q3_feature_code",
    )
    .eq("import_id", importId)
    .eq("owner_id", actor.userId)
    .in("validation_status", ["valid", "warning"])
    .order("source_row_number", { ascending: true });

  if (rowsError || !rows) {
    throw new AnalysisDataError(
      "analysis_source_failed",
      "Accepted feedback could not be loaded for analysis.",
    );
  }

  return prepareAnalysisInput(
    rows.map((row) => ({
      id: row.id,
      sourceRowNumber: row.source_row_number,
      normalizedTexts: row.normalized_texts,
      q2FeatureCodes: row.q2_feature_codes,
      q3FeatureCode: row.q3_feature_code,
    })),
  );
}

export async function replacePersistedAnalysis(
  actor: ImportActor,
  importId: string,
  model: string,
  analysisVersion: string,
  payload: AnalysisPersistencePayload,
): Promise<AnalysisPersistenceSummary> {
  const { data, error } = await actor.supabase.rpc(
    "replace_current_import_analysis",
    {
      p_import_id: importId,
      p_model_identifier: model,
      p_analysis_version: analysisVersion,
      p_payload: payload as unknown as Json,
    },
  );

  if (error) {
    throw new AnalysisDataError(
      "analysis_persistence_failed",
      "The validated analysis could not be saved atomically.",
    );
  }

  const parsed = persistenceResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new AnalysisDataError(
      "analysis_persistence_failed",
      "The analysis save did not return a valid summary.",
    );
  }

  return parsed.data;
}
