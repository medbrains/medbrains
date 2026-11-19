import { describe, expect, it } from "vitest";
import { createUserSchema, onboardingInitSchema, PASSWORD_MIN_LENGTH } from "./index";

const passwordIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) =>
  result.error?.issues.some(
    (issue) => issue.path[0] === "password" || issue.path[0] === "admin_password",
  ) ?? false;

describe("new passwords need 12 characters", () => {
  it("is 12", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("refuses 11 characters and accepts 12 when a user is created", () => {
    const user = {
      username: "drmeena",
      email: "meena@example.test",
      full_name: "Meena",
      role: "doctor",
    };
    expect(passwordIssue(createUserSchema.safeParse({ ...user, password: "Kq7#vLm2pXz" }))).toBe(
      true,
    );
    expect(passwordIssue(createUserSchema.safeParse({ ...user, password: "Kq7#vLm2pXzw" }))).toBe(
      false,
    );
  });

  it("refuses 11 characters for the first administrator", () => {
    const result = onboardingInitSchema.safeParse({ admin_password: "Kq7#vLm2pXz" });
    expect(passwordIssue(result)).toBe(true);
  });
});
