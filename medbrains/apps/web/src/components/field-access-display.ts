import type { FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";

export type PermissionedFieldKind = "text" | "name" | "identifier" | "phone" | "money";

export interface ProtectedFieldDisplayOptions {
  access: FieldAccessLevel;
  value: number | string | null | undefined;
  kind?: PermissionedFieldKind;
  fallback?: string;
  hiddenLabel?: string;
}

export interface ProtectedFieldDisplay {
  access: FieldAccessLevel;
  displayValue: string;
  isRestricted: boolean;
  restrictionLabel: string | null;
}

function stringValue(value: number | string | null | undefined, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function formatMoney(value: number | string | null | undefined, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return fallback;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return stringValue(value, fallback);
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

function displayValue(value: number | string | null | undefined, kind: PermissionedFieldKind) {
  if (kind === "money") {
    return formatMoney(value, "");
  }

  return stringValue(value, "");
}

function sharedFieldKind(kind: PermissionedFieldKind) {
  return kind === "money" ? "amount" : kind;
}

export function resolveProtectedFieldDisplay({
  access,
  value,
  kind = "text",
  fallback = "—",
  hiddenLabel = "Restricted",
}: ProtectedFieldDisplayOptions): ProtectedFieldDisplay {
  if (access === "hidden") {
    return {
      access,
      displayValue: hiddenLabel,
      isRestricted: true,
      restrictionLabel: "Hidden by field access policy",
    };
  }

  if (access === "mask") {
    const valueForMasking = displayValue(value, kind);
    return {
      access,
      displayValue: valueForMasking
        ? fieldAccessText(access, valueForMasking, sharedFieldKind(kind))
        : fallback,
      isRestricted: true,
      restrictionLabel: "Masked by field access policy",
    };
  }

  return {
    access,
    displayValue: kind === "money" ? formatMoney(value, fallback) : stringValue(value, fallback),
    isRestricted: false,
    restrictionLabel: null,
  };
}
