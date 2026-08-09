import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ParsedSurveyImport } from "@/lib/imports/types";
import type { Database, Json } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ImportActor = {
  userId: string;
  supabase: SupabaseServerClient;
};

export class ImportPersistenceError extends Error {
  constructor() {
    super("The import could not be saved. The previous current import is unchanged.");
    this.name = "ImportPersistenceError";
  }
}

export async function getImportActor(): Promise<ImportActor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    return null;
  }

  return { userId, supabase };
}

function toInsertRows(
  parsedImport: ParsedSurveyImport,
  importId: string,
  ownerId: string,
): Database["public"]["Tables"]["survey_responses"]["Insert"][] {
  return parsedImport.records.map((record) => ({
    import_id: importId,
    owner_id: ownerId,
    source_row_number: record.sourceRowNumber,
    raw_payload: record.rawPayload as Json,
    normalized_texts: record.normalizedTexts as Json,
    q2_feature_codes: record.q2FeatureCodes,
    q3_feature_code: record.q3FeatureCode,
    validation_status: record.validationStatus,
    validation_issues: record.validationIssues as Json,
  }));
}

async function deleteIncompleteImport(
  supabase: SupabaseServerClient,
  importId: string,
) {
  await supabase.from("imports").delete().eq("id", importId);
}

export async function persistSurveyImport(
  actor: ImportActor,
  filename: string,
  parsedImport: ParsedSurveyImport,
) {
  const { userId, supabase } = actor;
  const { data: previousImport, error: previousImportError } = await supabase
    .from("imports")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (previousImportError) {
    throw new ImportPersistenceError();
  }

  const { data: newImport, error: importError } = await supabase
    .from("imports")
    .insert({
      owner_id: userId,
      source_filename: filename,
      status: "validating",
      is_current: false,
      total_rows: parsedImport.summary.totalRows,
      accepted_rows: parsedImport.summary.acceptedRows,
      rejected_rows: parsedImport.summary.rejectedRows,
      warning_rows: parsedImport.summary.warningRows,
    })
    .select("id")
    .single();

  if (importError || !newImport) {
    throw new ImportPersistenceError();
  }

  const insertRows = toInsertRows(parsedImport, newImport.id, userId);

  try {
    for (let index = 0; index < insertRows.length; index += 250) {
      const { error } = await supabase
        .from("survey_responses")
        .insert(insertRows.slice(index, index + 250));

      if (error) {
        throw new ImportPersistenceError();
      }
    }

    if (previousImport) {
      const { data, error } = await supabase
        .from("imports")
        .update({ is_current: false })
        .eq("id", previousImport.id)
        .eq("owner_id", userId)
        .select("id")
        .single();

      if (error || !data) {
        throw new ImportPersistenceError();
      }
    }

    const { data: readyImport, error: readyError } = await supabase
      .from("imports")
      .update({ status: "ready", is_current: true })
      .eq("id", newImport.id)
      .eq("owner_id", userId)
      .select("id")
      .single();

    if (readyError || !readyImport) {
      throw new ImportPersistenceError();
    }
  } catch {
    if (previousImport) {
      await supabase
        .from("imports")
        .update({ is_current: true })
        .eq("id", previousImport.id)
        .eq("owner_id", userId);
    }

    await deleteIncompleteImport(supabase, newImport.id);
    throw new ImportPersistenceError();
  }

  return newImport.id;
}
