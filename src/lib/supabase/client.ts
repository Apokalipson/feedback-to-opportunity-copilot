"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./config";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, key } = getSupabasePublicEnv();

  return createBrowserClient<Database>(url, key);
}
