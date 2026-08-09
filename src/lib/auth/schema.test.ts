import { describe, expect, it } from "vitest";
import { loginSchema } from "./schema";

describe("loginSchema", () => {
  it("accepts a valid email and a non-empty password", () => {
    expect(
      loginSchema.safeParse({
        email: "pm@example.test",
        password: "Synthetic-only-password",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed credentials before calling Supabase", () => {
    const result = loginSchema.safeParse({ email: "bad", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
    }
  });
});
