import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PatientSearchBox } from "./PatientSearchBox";

// jsdom has no scrolling; the combobox scrolls its active option into view.
Element.prototype.scrollIntoView = vi.fn();

/** Open the "Search by" select and list what it offers. */
async function offered(opdOn: boolean): Promise<string[]> {
  render(
    <PatientSearchBox value="" onChange={vi.fn()} by="all" onByChange={vi.fn()} opdOn={opdOn} />,
  );
  fireEvent.click(screen.getByTestId("patient-search-by"));
  return (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
}

describe("the Search by choice", () => {
  it("offers OPD number only when the hospital keeps one", async () => {
    expect(await offered(false)).toEqual(["All", "Phone", "UHID", "Name"]);
  });

  it("lists OPD number when it is on", async () => {
    expect(await offered(true)).toContain("OPD number");
  });

  it("changes the placeholder with the choice", () => {
    render(<PatientSearchBox value="" onChange={vi.fn()} by="phone" onByChange={vi.fn()} opdOn />);
    expect(screen.getByTestId("patient-search-input")).toHaveAttribute(
      "placeholder",
      "Phone number",
    );
  });
});
