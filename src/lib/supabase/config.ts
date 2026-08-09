import { z } from "zod";

const optionalKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const supabasePublicEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalKey,
  })
  .refine(
    (value) =>
      Boolean(
        value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          value.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    {
      message: "A Supabase publishable or legacy anon key is required.",
      path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    },
  );

export type SupabasePublicEnvSource = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export function parseSupabasePublicEnv(source: SupabasePublicEnvSource) {
  const parsed = supabasePublicEnvSchema.parse(source);

  return {
    url: parsed.NEXT_PUBLIC_SUPABASE_URL,
    key:
      parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export function isSupabaseConfigured(source: SupabasePublicEnvSource) {
  return supabasePublicEnvSchema.safeParse(source).success;
}

export function getSupabasePublicEnv() {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function hasSupabasePublicEnv() {
  return isSupabaseConfigured({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
