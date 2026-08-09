import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(128, "Password is too long."),
});

export type LoginState = {
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
};
