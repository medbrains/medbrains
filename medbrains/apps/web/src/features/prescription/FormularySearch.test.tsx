import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { FormularySearch } from "./FormularySearch";
import type { FormularyDrug } from "./rxModel";

const server = vi.hoisted(() => ({ searches: [] as string[] }));
vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: {
    listPharmacyCatalog: ({ search }: { search: string }) => {
      server.searches.push(search);
      return Promise.resolve([]);
    },
  },
}));

// jsdom does not scroll; the combobox scrolls its highlighted option into view.
Element.prototype.scrollIntoView = () => {};

const drug = (id: string, name: string, extra: Partial<FormularyDrug> = {}): FormularyDrug => ({
  id,
  name,
  salt: name,
  form: "tablet",
  cls: "Analgesic",
  brands: [],
  strengths: ["500 mg"],
  kind: "rx",
  ...extra,
});

const formulary = [
  drug("d1", "Amoxicillin", { stock: 0 }),
  drug("d2", "Amlodipine", { stock: 3, reorderLevel: 10, kind: "otc" }),
];

/** Renders the search with spies for both outcomes. */
function setup(loading = false) {
  const onPick = vi.fn();
  const onBuyOutside = vi.fn();
  render(
    <FormularySearch
      formulary={formulary}
      loading={loading}
      onPick={onPick}
      onBuyOutside={onBuyOutside}
    />,
  );
  return { onPick, onBuyOutside, input: screen.getByLabelText("Search formulary") };
}

describe("the prescriber's drug search", () => {
  beforeEach(() => {
    server.searches = [];
  });

  it("warns of out-of-stock and low-stock drugs before they are added", async () => {
    const { input } = setup();
    await userEvent.type(input, "am");
    expect(await screen.findByText("out of stock")).toBeInTheDocument();
    expect(screen.getByText("low stock")).toBeInTheDocument();
    expect(screen.getByText("OTC")).toBeInTheDocument();
  });

  it("adds the clicked match and clears the search", async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, "amlo");
    await userEvent.click(await screen.findByText("Amlodipine"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "d2" }));
    expect(input).toHaveValue("");
  });

  it("writes a buy-outside line only when that option is chosen", async () => {
    const { input, onPick, onBuyOutside } = setup();
    await userEvent.type(input, "Zzz unknown ");
    expect(screen.getByText(/No match for/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Buy outside:/));
    expect(onBuyOutside).toHaveBeenCalledWith("Zzz unknown");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("asks the server too, for drugs past the loaded first hundred", async () => {
    const { input } = setup();
    await userEvent.type(input, "para");
    await waitFor(() => expect(server.searches).toContain("para"));
  });

  it("says the formulary is loading instead of 'no match'", async () => {
    const { input } = setup(true);
    await userEvent.type(input, "am");
    expect(screen.getByText(/Loading the formulary/)).toBeInTheDocument();
    expect(screen.queryByText(/No match for/)).toBeNull();
  });
});
