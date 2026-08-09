"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH, WORKSPACE_PATH } from "@/lib/auth/routes";
import { loginSchema, type LoginState } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      fieldErrors: validated.error.flatten().fieldErrors,
      message: "Check the highlighted fields and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validated.data);

  if (error) {
    return {
      message: "The email or password is incorrect.",
    };
  }

  redirect(WORKSPACE_PATH);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
