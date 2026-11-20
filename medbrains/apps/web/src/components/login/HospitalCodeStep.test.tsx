import { ApiError } from "@medbrains/api";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { classifyLookupFailure, HospitalCodeStep } from "./HospitalCodeStep";

function renderStep(lookupError: unknown = null) {
  render(
    <HospitalCodeStep
      initialCode=""
      unknownCode={null}
      lookupError={lookupError}
      checking={false}
      onSubmit={() => {}}
    />,
  );
}

describe("the hospital code step", () => {
  it("gives a made-up example code, never a real hospital's", () => {
    renderStep();
    expect(screen.getByText("The code your hospital gave you, e.g. CITYHOSP.")).toBeInTheDocument();
  });

  it("calls a 429 too many attempts, not unreachable", () => {
    const error = new ApiError("Too many", 429);
    expect(classifyLookupFailure(error)).toBe("rate_limited");
    renderStep(error);
    expect(screen.getByTestId("login-hospital-failed")).toHaveTextContent(
      "Too many attempts from this computer. Try again in a minute.",
    );
    expect(screen.queryByText(/Couldn't reach/)).not.toBeInTheDocument();
  });

  it("calls a network failure unreachable", () => {
    const error = new TypeError("Failed to fetch");
    expect(classifyLookupFailure(error)).toBe("unreachable");
    renderStep(error);
    expect(screen.getByTestId("login-hospital-failed")).toHaveTextContent(
      "Couldn't reach the hospital server.",
    );
  });

  it("calls a server error an error, not unreachable", () => {
    expect(classifyLookupFailure(new ApiError("boom", 500))).toBe("server_error");
  });
});
