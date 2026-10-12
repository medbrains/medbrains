import { requiredTrimmed } from "@medbrains/schemas";
import { z } from "zod";

export const loginFormSchema = z.object({
  username: requiredTrimmed("Username is required", 120),
  password: requiredTrimmed("Password is required", 256),
  remember_me: z.boolean(),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

export const DEFAULT_LOGIN_FORM_VALUES: LoginFormInput = {
  username: "",
  password: "",
  remember_me: false,
};
