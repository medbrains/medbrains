/**
 * Infrastructure smoke test for the MSW + fixture pipeline.
 *
 * Verifies:
 *   - MSW server intercepts `/api/auth/me` and serves authMeFixture
 *   - MSW server intercepts `/api/patients/{id}` and serves patientFixture
 *   - Test-utils `render()` wraps with QueryClient + Router properly
 *
 * If this test passes, page-level Vitest tests built on the same
 * infrastructure can be trusted. If it fails, there's a wiring issue
 * with handlers / setup / test-utils.
 */

import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { authMeFixture } from "../auth";
import { patientFixture } from "../patient";
import { SEED } from "../seed";
import { render, screen, waitFor } from "../../test/test-utils";

interface AuthMe {
  user: { id: string; full_name: string };
  csrf_token: string;
}

function AuthProbe() {
  const { data, isLoading } = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me");
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json();
    },
  });
  if (isLoading) return <div>Loading…</div>;
  if (!data) return <div>No data</div>;
  return <div data-testid="user-name">{data.user.full_name}</div>;
}

function PatientProbe({ id }: { id: string }) {
  const { data, isLoading } = useQuery<typeof patientFixture>({
    queryKey: ["patient", id],
    queryFn: async () => {
      const r = await fetch(`/api/patients/${id}`);
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json();
    },
  });
  if (isLoading) return <div>Loading…</div>;
  if (!data) return <div>No data</div>;
  return (
    <div>
      <span data-testid="uhid">{data.uhid}</span>
      <span data-testid="full-name">
        {data.first_name} {data.last_name}
      </span>
      <span data-testid="phone">{data.phone}</span>
    </div>
  );
}

describe("MSW + fixture pipeline", () => {
  it("serves the authMe fixture on /api/auth/me", async () => {
    render(<AuthProbe />);
    await waitFor(() => {
      expect(screen.getByTestId("user-name")).toHaveTextContent(authMeFixture.user.full_name);
    });
  });

  it("serves the patient fixture on /api/patients/{id}", async () => {
    render(<PatientProbe id={SEED.patient} />);
    await waitFor(() => {
      expect(screen.getByTestId("uhid")).toHaveTextContent(patientFixture.uhid);
    });
    expect(screen.getByTestId("full-name")).toHaveTextContent("Anika Verma");
    expect(screen.getByTestId("phone")).toHaveTextContent(patientFixture.phone);
  });

  it("fixture seed UUID is the canonical patient ID", () => {
    expect(patientFixture.id).toBe(SEED.patient);
  });
});
