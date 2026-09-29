import { requiredTrimmed } from "@medbrains/schemas";
import { z } from "zod";

export const loginFormSchema = z.object({
  username: requiredTrimmed("Username is required", 120),
  password: requiredTrimmed("Password is required", 256),
  remember_me: z.boolean(),
  /** Asked only when the username is used in more than one hospital. */
  hospital_code: z.string().trim().max(40),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

export const DEFAULT_LOGIN_FORM_VALUES: LoginFormInput = {
  username: "",
  password: "",
  remember_me: false,
  hospital_code: "",
};
