/**
 * Resolve seeded reference data (departments, drugs, lab tests, beds) so
 * specs don't hardcode UUIDs and keep working on a fresh DB.
 */

import { api } from "./api";
import type { AuthContext, SeedRefs } from "./types";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface CatalogRow {
  id: string;
  name: string;
  code: string;
  generic_name?: string | null;
  base_price?: string | number | null;
  current_stock?: number | null;
  drug_schedule?: string | null;
  is_controlled?: boolean | null;
  formulary_status?: string | null;
  is_lasa?: boolean | null;
  black_box_warning?: string | null;
}

interface BedRow {
  id: string;
  bed_number: string;
  status?: string;
}

const cache = new WeakMap<AuthContext, Partial<SeedRefs>>();

function getCache(ctx: AuthContext): Partial<SeedRefs> {
  let c = cache.get(ctx);
  if (!c) {
    c = {};
    cache.set(ctx, c);
  }
  return c;
}

export async function getDepartments(ctx: AuthContext): Promise<Department[]> {
  return api<Department[]>(ctx, "GET", "/api/setup/departments");
}

export async function getOpdDept(ctx: AuthContext): Promise<Department> {
  const c = getCache(ctx);
  if (c.opdDept) return c.opdDept;
  const depts = await getDepartments(ctx);
  if (depts.length === 0) throw new Error("no departments seeded");
  c.opdDept =
    depts.find((d) => /opd|general|consultation/i.test(d.name)) ??
    depts.find((d) => /opd|gen|cons/i.test(d.code)) ??
    depts[0];
  return c.opdDept;
}

export async function getIpdDept(ctx: AuthContext): Promise<Department> {
  const c = getCache(ctx);
  if (c.ipdDept) return c.ipdDept;
  const depts = await getDepartments(ctx);
  if (depts.length === 0) throw new Error("no departments seeded");
  c.ipdDept =
    depts.find((d) => /ipd|medicine|ward|inpatient/i.test(d.name)) ??
    depts.find((d) => /ipd|med|ward|in/i.test(d.code)) ??
    depts[0];
  return c.ipdDept;
}

export async function getFirstDrug(ctx: AuthContext): Promise<CatalogRow> {
  const c = getCache(ctx);
  if (c.drug) return c.drug;
  const list = await api<CatalogRow[]>(ctx, "GET", "/api/pharmacy/catalog");
  c.drug = list.find(isSafeE2eDrug) ?? (await createSafeE2eDrug(ctx));
  return c.drug;
}

function isSafeE2eDrug(drug: CatalogRow): boolean {
  const schedule = drug.drug_schedule?.toLowerCase() ?? "";
  const formulary = drug.formulary_status?.toLowerCase() ?? "approved";
  return (
    (drug.current_stock ?? 0) >= 100 &&
    drug.is_controlled !== true &&
    !["ndps", "x", "h1"].includes(schedule) &&
    drug.is_lasa !== true &&
    formulary !== "restricted" &&
    !drug.black_box_warning
  );
}

async function createSafeE2eDrug(ctx: AuthContext): Promise<CatalogRow> {
  const stamp = Date.now().toString(36);
  return api<CatalogRow>(ctx, "POST", "/api/pharmacy/catalog", {
    code: `E2E-SAFE-${stamp}`,
    name: `E2E Safe Paracetamol ${stamp}`,
    generic_name: "Paracetamol",
    category: "analgesic",
    manufacturer: "E2E Fixtures",
    unit: "tablet",
    base_price: 5,
    tax_percent: 0,
    current_stock: 500,
    reorder_level: 25,
    drug_schedule: "OTC",
    is_controlled: false,
    inn_name: "paracetamol",
    atc_code: "N02BE01",
    formulary_status: "approved",
    is_lasa: false,
    batch_tracking_required: false,
  });
}

export async function getFirstLabTest(ctx: AuthContext): Promise<CatalogRow> {
  const c = getCache(ctx);
  if (c.labTest) return c.labTest;
  const list = await api<CatalogRow[]>(ctx, "GET", "/api/lab/catalog");
  if (list.length === 0) throw new Error("lab catalog empty");
  c.labTest = list[0];
  return c.labTest;
}

export async function getAvailableBed(
  ctx: AuthContext,
): Promise<BedRow | undefined> {
  const c = getCache(ctx);
  if (c.bed) return c.bed;
  try {
    const beds = await api<BedRow[]>(ctx, "GET", "/api/ipd/beds/available");
    if (beds.length === 0) return undefined;
    c.bed = beds[0];
    return c.bed;
  } catch {
    return undefined;
  }
}

export async function resolveSeedRefs(ctx: AuthContext): Promise<SeedRefs> {
  const [opdDept, ipdDept, drug, labTest, bed] = await Promise.all([
    getOpdDept(ctx),
    getIpdDept(ctx),
    getFirstDrug(ctx),
    getFirstLabTest(ctx),
    getAvailableBed(ctx),
  ]);
  return { opdDept, ipdDept, drug, labTest, bed };
}
