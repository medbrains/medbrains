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
  batch_tracking_required?: boolean | null;
}

interface BedRow {
  id: string;
  bed_number: string;
  status?: string;
}

interface FefoBatchOption {
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
}

interface FefoSelectResponse {
  batches: FefoBatchOption[];
  quantity_needed: number;
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
  const candidates = list
    .filter(isSafeE2eDrug)
    .sort((left, right) => Number(isE2eFefoDrug(right)) - Number(isE2eFefoDrug(left)));

  for (const drug of candidates) {
    if (await hasUsableFefoStock(ctx, drug, 20)) {
      c.drug = drug;
      return drug;
    }
  }

  c.drug = await createSafeE2eDrug(ctx);
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

function isE2eFefoDrug(drug: CatalogRow): boolean {
  return drug.code.startsWith("E2E-FEFO-");
}

async function hasUsableFefoStock(
  ctx: AuthContext,
  drug: CatalogRow,
  quantityNeeded: number,
): Promise<boolean> {
  const result = await api<FefoSelectResponse>(ctx, "POST", "/api/pharmacy/batches/fefo-select", {
    catalog_item_id: drug.id,
    quantity_needed: quantityNeeded,
  });
  return result.batches.some((batch) => batch.quantity_on_hand >= quantityNeeded);
}

async function createSafeE2eDrug(ctx: AuthContext): Promise<CatalogRow> {
  const stamp = Date.now().toString(36);
  const drug = await api<CatalogRow>(ctx, "POST", "/api/pharmacy/catalog", {
    code: `E2E-FEFO-${stamp}`,
    name: `E2E FEFO Paracetamol ${stamp}`,
    generic_name: "Paracetamol",
    category: "analgesic",
    manufacturer: "E2E Fixtures",
    unit: "tablet",
    base_price: 5,
    tax_percent: 0,
    current_stock: 0,
    reorder_level: 25,
    drug_schedule: "OTC",
    is_controlled: false,
    inn_name: "paracetamol",
    atc_code: "N02BE01",
    formulary_status: "approved",
    is_lasa: false,
    batch_tracking_required: true,
  });

  await createUsableE2eBatch(ctx, drug.id, `${stamp}-A`, 180, 400);
  await createUsableE2eBatch(ctx, drug.id, `${stamp}-B`, 540, 400);
  return { ...drug, current_stock: 800, batch_tracking_required: true };
}

async function createUsableE2eBatch(
  ctx: AuthContext,
  catalogItemId: string,
  suffix: string,
  expiryDaysFromNow: number,
  quantity: number,
): Promise<void> {
  await api(ctx, "POST", "/api/pharmacy/batches", {
    catalog_item_id: catalogItemId,
    batch_number: `E2E-FEFO-${suffix}`,
    expiry_date: dateDaysFromNow(expiryDaysFromNow),
    manufacture_date: dateDaysFromNow(-30),
    quantity_received: quantity,
    supplier_info: "E2E FEFO fixture",
  });
}

function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
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
