import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { hasSupabasePublicEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { loadReviewWorkspace } from "@/lib/data/review";
import type { ReviewWorkspaceData } from "@/lib/review/types";

export const requireUser = cache(async () => {
  if (!hasSupabasePublicEnv()) {
    redirect(`${LOGIN_PATH}?setup=required`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    redirect(LOGIN_PATH);
  }

  return { userId };
});

export const getWorkspaceOverview = cache(async () => {
  const { userId } = await requireUser();
  const supabase = await createClient();

  const [profileResult, importResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single(),
    supabase
      .from("imports")
      .select(
        "id, source_filename, status, total_rows, accepted_rows, rejected_rows, warning_rows, created_at",
      )
      .eq("owner_id", userId)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new Error("The authenticated user profile is unavailable.");
  }

  if (importResult.error) {
    throw new Error("The current import could not be loaded.");
  }

  let currentAnalysis = { analyses: 0, groups: 0, cards: 0 };
  let reviewWorkspace: ReviewWorkspaceData = {
    totalRows: 0,
    responses: [],
    cards: [],
  };
  if (importResult.data) {
    const [analysesResult, groupsResult, cardsResult] = await Promise.all([
      supabase
        .from("response_analyses")
        .select("id", { count: "exact", head: true })
        .eq("import_id", importResult.data.id)
        .eq("owner_id", userId),
      supabase
        .from("feedback_groups")
        .select("id", { count: "exact", head: true })
        .eq("import_id", importResult.data.id)
        .eq("owner_id", userId),
      supabase
        .from("opportunity_cards")
        .select("id", { count: "exact", head: true })
        .eq("import_id", importResult.data.id)
        .eq("owner_id", userId),
    ]);

    if (analysesResult.error || groupsResult.error || cardsResult.error) {
      throw new Error("The current analysis summary could not be loaded.");
    }

    currentAnalysis = {
      analyses: analysesResult.count ?? 0,
      groups: groupsResult.count ?? 0,
      cards: cardsResult.count ?? 0,
    };
    reviewWorkspace = await loadReviewWorkspace(
      userId,
      importResult.data.id,
      importResult.data.total_rows,
    );
  }

  return {
    displayName: profileResult.data.display_name,
    currentImport: importResult.data,
    currentAnalysis,
    reviewWorkspace,
  };
});
