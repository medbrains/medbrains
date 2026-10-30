import { usePermissionStore } from "@medbrains/stores";
import { type HbcrCoding, P, type RegistryCase, type RegistryWorklistRow } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { AbstractModal } from "./AbstractModal";
import { matchesFilter, toCoding, toFormValues } from "./registry-form";

const getCase = vi.fn();
const save = vi.fn();
const submitted = vi.fn();
vi.mock("@/services/specialty.service", () => ({
  specialtyService: {
    getRegistryCase: (id: string) => getCase(id),
    getRegistryCodeLists: () =>
      Promise.resolve({ method_of_diagnosis: [[2, "Microscopic"]], ecog: [[1, "Restricted"]] }),
    saveRegistryAbstract: (id: string, body: unknown) => save(id, body),
    markRegistrySubmitted: (id: string, r: string) => submitted(id, r),
  },
}));

const blank: HbcrCoding = {
  hbcr_registration_no: null,
  date_of_first_diagnosis: null,
  case_registered_through: null,
  referral_type: null,
  method_of_diagnosis: null,
  icdo3_topography: null,
  icdo3_morphology: null,
  icd10_code: null,
  laterality: null,
  sequence: null,
  extent_of_disease: null,
  staging_system: null,
  prior_treatment: null,
  intention: null,
  ecog: null,
  treatment_at_ri: null,
};

const kase = (status: RegistryCase["status"], coding = blank): RegistryCase => ({
  facts: {
    staging_id: "s1",
    patient_id: "p1",
    uhid: "UH001",
    patient_name: "Lakshmi R",
    date_of_birth: "1970-06-15",
    gender: "female",
    address: null,
    primary_site: "Breast",
    histology: "Infiltrating duct carcinoma",
    t_stage: "T2",
    n_stage: "N1",
    m_stage: "M0",
    overall_stage: "IIB",
    staged_at: null,
  },
  status,
  coding,
  missing: status === "draft" ? ["25 laterality"] : [],
  ncdir_reference: status === "submitted" ? "NCDIR-77" : null,
});

const all = [
  P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_LIST,
  P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_ABSTRACT,
  P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_EXPORT,
];

beforeEach(() => {
  for (const f of [getCase, save, submitted]) f.mockReset();
  usePermissionStore.getState().setPermissions("mrd_officer", all);
});

describe("cancer registry", () => {
  it("round-trips a coding through the form, blanks back to null", () => {
    const coded = { ...blank, method_of_diagnosis: 2, sequence: 0, icd10_code: "C50.4" };
    expect(toCoding(toFormValues(coded))).toEqual(coded);
    expect(toFormValues(coded).sequence).toBe("0");
  });

  it("keeps submitted cases off the default worklist", () => {
    const row = (status: RegistryWorklistRow["status"]) => ({ status }) as RegistryWorklistRow;
    expect(matchesFilter(row("submitted"), "open")).toBe(false);
    expect(matchesFilter(row("due"), "open")).toBe(true);
    expect(matchesFilter(row("submitted"), "all")).toBe(true);
  });

  it("shows what the record holds and what is still missing", async () => {
    getCase.mockResolvedValue(kase("draft"));
    render(<AbstractModal stagingId="s1" onClose={() => {}} />);
    expect(await screen.findByText(/Lakshmi R · UH001/)).toBeInTheDocument();
    expect(screen.getByText(/TNM T2 N1 M0 · Stage IIB/)).toBeInTheDocument();
    expect(screen.getByText("25 laterality")).toBeInTheDocument();
  });

  it("refuses a malformed morphology before it reaches the server", async () => {
    getCase.mockResolvedValue(kase("draft"));
    render(<AbstractModal stagingId="s1" onClose={() => {}} />);
    await userEvent.type(await screen.findByLabelText(/morphology/i), "8500");
    await userEvent.click(screen.getByRole("button", { name: /save abstract/i }));
    expect(await screen.findByText(/looks like 8500\/3/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("records the NCDIR registration for a complete case", async () => {
    getCase.mockResolvedValue(kase("complete"));
    submitted.mockResolvedValue(kase("submitted"));
    render(<AbstractModal stagingId="s1" onClose={() => {}} />);
    await userEvent.type(await screen.findByLabelText(/NCDIR registration/i), "NCDIR-77");
    await userEvent.click(screen.getByRole("button", { name: /mark submitted/i }));
    expect(submitted).toHaveBeenCalledWith("s1", "NCDIR-77");
  });

  it("locks a submitted abstract", async () => {
    getCase.mockResolvedValue(kase("submitted"));
    render(<AbstractModal stagingId="s1" onClose={() => {}} />);
    expect(await screen.findByText(/Submitted to NCDIR as NCDIR-77/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save abstract/i })).not.toBeInTheDocument();
  });

  it("gives a clerk without export no way to mark submitted", async () => {
    usePermissionStore.getState().setPermissions("mrd_officer", all.slice(0, 2));
    getCase.mockResolvedValue(kase("complete"));
    render(<AbstractModal stagingId="s1" onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: /save abstract/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark submitted/i })).not.toBeInTheDocument();
  });
});
