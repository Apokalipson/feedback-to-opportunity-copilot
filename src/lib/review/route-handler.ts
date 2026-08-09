import { NextResponse } from "next/server";
import {
  REVIEW_LIMITS,
  reviewMutationSchema,
} from "@/lib/review/contract";
import { ReviewDataError } from "@/lib/data/review";
import type { ImportActor } from "@/lib/data/imports";
import { isTrustedMutationOrigin } from "@/lib/imports/request";
import type {
  ReviewApiFailure,
  ReviewApiSuccess,
} from "@/lib/review/types";

type SaveResult = Omit<ReviewApiSuccess, "ok">;

type ReviewRouteDependencies = {
  getActor: () => Promise<ImportActor | null>;
  saveReview: (
    actor: ImportActor,
    input: ReturnType<typeof reviewMutationSchema.parse>,
  ) => Promise<SaveResult>;
};

type BoundedJsonResult =
  | { kind: "ok"; body: unknown }
  | { kind: "malformed" }
  | { kind: "too_large" };

async function readBoundedJson(request: Request): Promise<BoundedJsonResult> {
  if (!request.body) {
    return { kind: "malformed" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > REVIEW_LIMITS.maxRequestBytes) {
        await reader.cancel();
        return { kind: "too_large" };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { kind: "ok", body: JSON.parse(text) as unknown };
  } catch {
    return { kind: "malformed" };
  }
}

function failure(
  code: string,
  message: string,
  status: number,
): NextResponse<ReviewApiFailure> {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function createReviewPatchHandler(
  dependencies: ReviewRouteDependencies,
) {
  return async function reviewPatch(request: Request) {
    if (!isTrustedMutationOrigin(request)) {
      return failure(
        "invalid_origin",
        "The Opportunity Card review origin is invalid.",
        403,
      );
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > REVIEW_LIMITS.maxRequestBytes
    ) {
      return failure(
        "request_too_large",
        "The Opportunity Card review request is too large.",
        413,
      );
    }

    const contentType = request.headers.get("content-type")?.toLowerCase();
    if (!contentType?.startsWith("application/json")) {
      return failure(
        "unsupported_content_type",
        "The Opportunity Card review must use JSON.",
        415,
      );
    }

    const actor = await dependencies.getActor();
    if (!actor) {
      return failure(
        "unauthorized",
        "Sign in before reviewing an Opportunity Card.",
        401,
      );
    }

    const boundedJson = await readBoundedJson(request);
    if (boundedJson.kind === "too_large") {
      return failure(
        "request_too_large",
        "The Opportunity Card review request is too large.",
        413,
      );
    }
    if (boundedJson.kind === "malformed") {
      return failure(
        "malformed_request",
        "The Opportunity Card review request is malformed.",
        400,
      );
    }

    const parsed = reviewMutationSchema.safeParse(boundedJson.body);
    if (!parsed.success) {
      return failure(
        "invalid_review",
        "The Opportunity Card review does not satisfy the review contract.",
        400,
      );
    }

    try {
      const result = await dependencies.saveReview(actor, parsed.data);
      return NextResponse.json(
        { ok: true, ...result } satisfies ReviewApiSuccess,
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ReviewDataError) {
        const status =
          error.code === "stale_review" ||
          error.code === "review_unavailable"
            ? 409
            : error.code === "no_changes" || error.code === "review_invalid"
              ? 422
              : 500;
        return failure(error.code, error.message, status);
      }

      return failure(
        "review_failed",
        "The Opportunity Card review could not be saved safely.",
        500,
      );
    }
  };
}
