import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { HospitalCodeStep } from "./HospitalCodeStep";

describe("the hospital code step", () => {
  it("gives a made-up example code, never a real hospital's", () => {
    render(
      <HospitalCodeStep
        initialCode=""
        unknownCode={null}
        failed={false}
        checking={false}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText("The code your hospital gave you, e.g. CITYHOSP.")).toBeInTheDocument();
  });
});
