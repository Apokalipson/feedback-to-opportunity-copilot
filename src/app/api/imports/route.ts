import { NextResponse } from "next/server";
import {
  getImportActor,
  ImportPersistenceError,
  persistSurveyImport,
} from "@/lib/data/imports";
import { CSV_IMPORT_LIMITS } from "@/lib/imports/contract";
import { parseSurveyCsv } from "@/lib/imports/parser";
import { isTrustedMutationOrigin } from "@/lib/imports/request";
import {
  CsvImportError,
  type ImportApiFailure,
  type ImportApiSuccess,
} from "@/lib/imports/types";

export const runtime = "nodejs";

const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function failure(
  code: string,
  message: string,
  status: number,
): NextResponse<ImportApiFailure> {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request) {
  if (!isTrustedMutationOrigin(request)) {
    return failure("invalid_origin", "The import request origin is invalid.", 403);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength >
      CSV_IMPORT_LIMITS.maxBytes + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return failure(
      "file_too_large",
      `The CSV file exceeds the ${CSV_IMPORT_LIMITS.maxBytes / 1024 / 1024} MiB limit.`,
      413,
    );
  }

  const actor = await getImportActor();
  if (!actor) {
    return failure("unauthorized", "Sign in before importing a CSV file.", 401);
  }

  let file: File;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    if (!(candidate instanceof File)) {
      return failure("missing_file", "Choose a CSV file to import.", 400);
    }
    file = candidate;
  } catch {
    return failure("malformed_request", "The upload request is malformed.", 400);
  }

  if (file.size > CSV_IMPORT_LIMITS.maxBytes) {
    return failure(
      "file_too_large",
      `The CSV file exceeds the ${CSV_IMPORT_LIMITS.maxBytes / 1024 / 1024} MiB limit.`,
      413,
    );
  }

  try {
    const parsedImport = parseSurveyCsv({
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const importId = await persistSurveyImport(actor, file.name, parsedImport);
    const response: ImportApiSuccess = {
      ok: true,
      importId,
      filename: file.name,
      summary: parsedImport.summary,
      warnings: parsedImport.warnings,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof CsvImportError) {
      const status = error.code === "file_too_large" ? 413 : 400;
      return failure(error.code, error.message, status);
    }

    if (error instanceof ImportPersistenceError) {
      return failure("persistence_failed", error.message, 500);
    }

    return failure(
      "import_failed",
      "The import could not be completed safely.",
      500,
    );
  }
}
