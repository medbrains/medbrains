import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

/**
 * The picker's decisions: it never asks without a SNOMED permission, never
 * asks for fewer than three letters, and says "not loaded" — not "no match"
 * — before the licensed release is imported.
 */
const held = new Set<string>();
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.has(c)),
}));

const search = vi.fn(async () => ({ loaded: true, results: [] as unknown[] }));
vi.mock("@/services/snomed.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/snomed.service")>()),
  snomedService: { search: (...args: unknown[]) => search(...(args as [])) },
}));

const { SnomedConceptSelect } = await import("./SnomedConceptSelect");

function setup(codes: string[]) {
  held.clear();
  for (const c of codes) held.add(c);
  search.mockClear();
  const onChange = vi.fn();
  render(<SnomedConceptSelect value={null} onChange={onChange} placeholder="Find concept" />);
  return { input: screen.getByPlaceholderText("Find concept"), onChange };
}

describe("SnomedConceptSelect", () => {
  it("searches once three letters are typed", async () => {
    const { input } = setup(["terminology.snomed.view"]);
    await userEvent.type(input, "fev");
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: "fev" })));
  });

  it("does not search on two letters", async () => {
    const { input } = setup(["terminology.snomed.view"]);
    await userEvent.type(input, "fe");
    await waitFor(() => expect(screen.getByDisplayValue("fe")).toBeInTheDocument());
    expect(search).not.toHaveBeenCalled();
  });

  it("asks nothing without a SNOMED permission", async () => {
    const { input } = setup([]);
    await userEvent.type(input, "fever");
    await waitFor(() => expect(screen.getByDisplayValue("fever")).toBeInTheDocument());
    expect(search).not.toHaveBeenCalled();
  });

  it("says the release is not loaded instead of 'no match'", async () => {
    search.mockResolvedValueOnce({ loaded: false, results: [] });
    const { input } = setup(["terminology.snomed.view"]);
    await userEvent.type(input, "fever");
    expect(await screen.findByText(/SNOMED CT is not loaded yet/)).toBeInTheDocument();
    expect(screen.queryByText(/No SNOMED CT concept matches/)).not.toBeInTheDocument();
  });

  it("hands back the chosen concept with its string id", async () => {
    search.mockResolvedValue({
      loaded: true,
      results: [
        {
          concept_id: "169999999108",
          preferred_term: "Synthetic fever",
          fsn: "Synthetic fever (finding)",
          semantic_tag: "finding",
          active: true,
          matched_term: null,
        },
      ],
    });
    const { input, onChange } = setup(["terminology.snomed.analytics"]);
    await userEvent.type(input, "synth");
    await userEvent.click(await screen.findByText("Synthetic fever"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ concept_id: "169999999108" }));
  });
});
