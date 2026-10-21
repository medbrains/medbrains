import type { StartupCheck } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { StartupChecksCard } from "./StartupChecksCard";

const ok: StartupCheck = {
  check: "db.version",
  level: "ok",
  detail: "PostgreSQL 160004",
  fix: null,
};
const warn: StartupCheck = {
  check: "auth.default_admin",
  level: "warn",
  detail: "admin still sign in with the default password",
  fix: "Sign in as each one and change the password now",
};
const fail: StartupCheck = {
  check: "secret.identifier_key",
  level: "fail",
  detail: "MEDBRAINS_IDENTIFIER_HMAC_KEY could not be read",
  fix: "Set it: openssl rand -base64 48",
};

describe("StartupChecksCard", () => {
  it("lists failures first, then warnings, each named in words with its fix", () => {
    render(<StartupChecksCard checks={[ok, warn, fail]} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Fail"),
      expect.stringContaining("Warning"),
      expect.stringContaining("OK"),
    ]);
    expect(screen.getByText("2 of 3 checks need attention.")).toBeInTheDocument();
    expect(screen.getByText("Set it: openssl rand -base64 48")).toBeInTheDocument();
  });

  it("says when every check passed", () => {
    render(<StartupChecksCard checks={[ok]} />);
    expect(screen.getByText("All 1 checks passed.")).toBeInTheDocument();
  });

  it("does not read an older server's silence as all clear", () => {
    render(<StartupChecksCard checks={[]} />);
    expect(screen.getByText(/has not reported its startup checks/)).toBeInTheDocument();
    expect(screen.queryByText(/checks passed/)).not.toBeInTheDocument();
  });
});
