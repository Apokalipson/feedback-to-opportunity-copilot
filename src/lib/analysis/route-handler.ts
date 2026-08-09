import { NextResponse } from "next/server";
import { z } from "zod";
import { AnalysisContractError } from "@/lib/analysis/contract";
import { AnalysisProviderError } from "@/lib/analysis/openai";
import { analyzeCurrentImport } from "@/lib/analysis/service";
import type {
  AnalysisApiFailure,
  AnalysisApiSuccess,
} from "@/lib/analysis/types";
import { AnalysisDataError } from "@/lib/data/analysis";
import type { ImportActor } from "@/lib/data/imports";
import { isTrustedMutationOrigin } from "@/lib/imports/request";

const MAX_REQUEST_BYTES = 1024;
const requestSchema = z.object({ importId: z.string().uuid() }).strict();

type AnalysisResult = Awaited<ReturnType<typeof analyzeCurrentImport>>;

type AnalysisRouteDependencies = {
  getActor: () => Promise<ImportActor | null>;
  analyze: (actor: ImportActor, importId: string) => Promise<AnalysisResult>;
};

function failure(
  code: string,
  message: string,
  status: number,
): NextResponse<AnalysisApiFailure> {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function createAnalysisPostHandler(
  dependencies: AnalysisRouteDependencies,
) {
  return async function analysisPost(request: Request) {
    if (!isTrustedMutationOrigin(request)) {
      return failure(
        "invalid_origin",
        "The analysis request origin is invalid.",
        403,
      );
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return failure(
        "request_too_large",
        "The analysis request is too large.",
        413,
      );
    }

    const contentType = request.headers.get("content-type")?.toLowerCase();
    if (!contentType?.startsWith("application/json")) {
      return failure(
        "unsupported_content_type",
        "The analysis request must use JSON.",
        415,
      );
    }

    const actor = await dependencies.getActor();
    if (!actor) {
      return failure(
        "unauthorized",
        "Sign in before starting AI analysis.",
        401,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(
        "malformed_request",
        "The analysis request is malformed.",
        400,
      );
    }

    const parsedRequest = requestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return failure(
        "invalid_request",
        "The analysis request does not identify a valid import.",
        400,
      );
    }

    try {
      const result = await dependencies.analyze(
        actor,
        parsedRequest.data.importId,
      );
      const response: AnalysisApiSuccess = { ok: true, ...result };
      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      if (error instanceof AnalysisContractError) {
        const status = error.code === "invalid_ai_output" ? 502 : 422;
        return failure(error.code, error.message, status);
      }

      if (error instanceof AnalysisProviderError) {
        return failure("analysis_provider_failed", error.message, 502);
      }

      if (error instanceof AnalysisDataError) {
        const status = error.code === "import_not_current" ? 409 : 500;
        return failure(error.code, error.message, status);
      }

      return failure(
        "analysis_failed",
        "The analysis could not be completed safely.",
        500,
      );
    }
  };
}
