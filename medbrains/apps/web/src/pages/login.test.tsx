import type { SignInOptions } from "@medbrains/types";
import { fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { LoginPage } from "./login";

/**
 * A refused sign-in must leave the person where they were. The hospital
 * chosen in step 1 used to live only in the page's own state, so anything
 * that remounted the page — a dev-server reload, a Suspense or error-boundary
 * reset — dropped them back to "which hospital?" with the attempt forgotten.
 */

const DEFAULT: SignInOptions = {
  code: "DEFAULT",
  name: "Default Hospital",
  password: true,
  providers: [],
};

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSignInOptions: async (code?: string) => {
        if (code?.toUpperCase() === "DEFAULT") return DEFAULT;
        throw new actual.ApiError("not found", 404);
      },
      onboardingStatus: async () => ({ needs_setup: false, trial_open: false }),
      getTenantByHost: async () => null,
      login: async () => {
        throw new actual.ApiError("Invalid username or password", 401);
      },
    },
  };
});

/** A host that can remount the login page while the router (the URL) stays. */
function Remountable() {
  const [generation, setGeneration] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setGeneration((g) => g + 1)}>
        remount
      </button>
      <Routes>
        <Route path="/login" element={<LoginPage key={generation} />} />
      </Routes>
    </>
  );
}

async function chooseHospital(code: string) {
  fireEvent.change(await screen.findByTestId("login-hospital-code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("LoginPage", () => {
  it("keeps the chosen hospital across a refused attempt and a remount", async () => {
    render(<Remountable />, { initialEntries: ["/login"] });

    await chooseHospital("NO-SUCH");
    expect(await screen.findByText(/No hospital uses the code "NO-SUCH"/)).toBeInTheDocument();

    await chooseHospital("default");
    await waitFor(() =>
      expect(screen.getByTestId("login-hospital-name")).toHaveTextContent("Default Hospital"),
    );
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "nurse" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByTestId("login-error")).toHaveTextContent("Invalid username");

    fireEvent.click(screen.getByRole("button", { name: "remount" }));
    expect(await screen.findByLabelText(/Username/)).toBeInTheDocument();
    expect(screen.getByTestId("login-hospital-name")).toHaveTextContent("Default Hospital");
    expect(screen.queryByTestId("login-hospital-code")).toBeNull();
  });

  it("forgets the hospital when the person changes it", async () => {
    render(<Remountable />, { initialEntries: ["/login?hospital=default"] });
    fireEvent.click(await screen.findByTestId("login-change-hospital"));
    fireEvent.click(screen.getByRole("button", { name: "remount" }));
    await waitFor(() => expect(screen.getByTestId("login-hospital-code")).toBeInTheDocument());
  });
});
