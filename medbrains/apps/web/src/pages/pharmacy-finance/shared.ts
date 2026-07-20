// Pharmacy-finance shared helpers/types — split from pharmacy-finance.tsx (pure move).

import type { FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";

export interface CashDrawerRow {
  id: string;
  pharmacy_location_id: string;
  cashier_user_id: string;
  opened_at: string;
  opening_float: string;
  closed_at?: string | null;
  expected_close_amount?: string | null;
  actual_close_amount?: string | null;
  variance?: string | null;
  status: string;
}

export function canEditFinanceAmount(access: FieldAccessLevel): boolean {
  return access === "edit";
}

export function canViewFinanceAmount(access: FieldAccessLevel): boolean {
  return access === "edit" || access === "view";
}

export function financeAmountText(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  return fieldAccessText(access, value == null || value === "" ? undefined : `₹${value}`, "amount");
}
