import type { MpiMatchResult } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DuplicateMatchTable } from "./DuplicateMatchTable";

const match = (over: Partial<MpiMatchResult>): MpiMatchResult => ({
  id: "p1",
  uhid: "UH-1",
  first_name: "Lakshmi",
  last_name: "",
  date_of_birth: "1984-03-12",
  phone: "9840012345",
  gender: "female",
  score: 0.99,
  pharmacy_customer: false,
  ...over,
});

describe("DuplicateMatchTable", () => {
  it("says how sure the check is and why, not a bare percentage", () => {
    render(
      <DuplicateMatchTable
        matches={[
          match({
            band: "likely",
            reasons: ["Name matches in another spelling", "Date of birth matches"],
          }),
          match({ id: "p2", first_name: "Shyam", band: "review", reasons: ["Name differs"] }),
        ]}
        onOpen={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    // No i18n backend in tests: the keys stand for "Likely same" and
    // "Check".
    expect(screen.getByText("match.band.likely")).toBeInTheDocument();
    expect(screen.getByText("match.band.review")).toBeInTheDocument();
    expect(screen.getByText("Name matches in another spelling")).toBeInTheDocument();
    expect(screen.queryByText("99%")).not.toBeInTheDocument();
  });
});
