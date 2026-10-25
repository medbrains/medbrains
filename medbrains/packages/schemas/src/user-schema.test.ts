import { describe, expect, it } from "vitest";
import { userSchema } from "./index";

const signedIn = (role: string) => ({
  id: "1bdfce1e-0485-421f-8991-1eb8ecec08d6",
  tenant_id: "3f2b8c1e-5d4a-4e6b-9c7d-2a1b0c9d8e7f",
  username: "research_officer",
  email: "research.officer@g2demo.example",
  full_name: "Kavitha Raman",
  role,
  access_matrix: {},
  is_active: true,
  created_at: "",
  updated_at: "",
});

describe("every role the server has can sign in", () => {
  it("accepts roles beyond the original eleven, and the SSO default", () => {
    for (const role of ["mrd_officer", "radiology_tech", "staff", "hospital_admin"]) {
      expect(userSchema.parse(signedIn(role)).role).toBe(role);
    }
  });

  it("still refuses a user with no role", () => {
    expect(() => userSchema.parse(signedIn(""))).toThrow();
  });
});
