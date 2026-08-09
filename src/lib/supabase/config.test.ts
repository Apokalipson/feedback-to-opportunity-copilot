import { describe, expect, it } from "vitest";
import {
  isSupabaseConfigured,
  parseSupabasePublicEnv,
} from "./config";

describe("Supabase public environment", () => {
  it("prefers the current publishable key", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-example",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_example",
    });
  });

  it("accepts a legacy anon key for an existing project", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-example",
      }).key,
    ).toBe("legacy-example");
  });

  it("rejects missing keys and invalid URLs", () => {
    expect(
      isSupabaseConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toBe(false);
  });
});
