import { Text, type TextProps, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { FieldAccessLevel } from "@medbrains/types";

export type PermissionedFieldKind = "text" | "name" | "identifier" | "phone" | "money";

interface ProtectedFieldValueOptions {
  fieldCode?: string;
  fieldCodes?: readonly string[];
  value: number | string | null | undefined;
  kind?: PermissionedFieldKind;
  fallback?: string;
  hiddenLabel?: string;
}

interface ProtectedFieldValue {
  access: FieldAccessLevel;
  displayValue: string;
  isRestricted: boolean;
  restrictionLabel: string | null;
}

interface PermissionedFieldValueProps
  extends ProtectedFieldValueOptions,
    Omit<TextProps, "children"> {
  withRestrictionTooltip?: boolean;
}

const accessRank: Record<FieldAccessLevel, number> = {
  edit: 0,
  view: 1,
  mask: 2,
  hidden: 3,
};

function mostRestrictedAccess(accessLevels: FieldAccessLevel[]): FieldAccessLevel {
  return accessLevels.reduce<FieldAccessLevel>((current, next) => {
    return accessRank[next] > accessRank[current] ? next : current;
  }, "edit");
}

function normalizeFieldCodes(fieldCode?: string, fieldCodes?: readonly string[]) {
  const codes = new Set<string>();
  if (fieldCode) {
    codes.add(fieldCode);
  }
  for (const code of fieldCodes ?? []) {
    codes.add(code);
  }

  return [...codes];
}

function stringValue(value: number | string | null | undefined, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function maskName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}***`)
    .join(" ");
}

function maskIdentifier(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.min(normalized.length - 4, 8))}${normalized.slice(-4)}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "****";
  }

  return `******${digits.slice(-4)}`;
}

function formatMoney(value: number | string | null | undefined, fallback: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return stringValue(value, fallback);
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

function maskValue(
  value: number | string | null | undefined,
  kind: PermissionedFieldKind,
  fallback: string,
) {
  const text = kind === "money" ? formatMoney(value, fallback) : stringValue(value, fallback);
  if (text === fallback) {
    return fallback;
  }

  if (kind === "name") {
    return maskName(text);
  }

  if (kind === "identifier") {
    return maskIdentifier(text);
  }

  if (kind === "phone") {
    return maskPhone(text);
  }

  if (kind === "money") {
    return "₹****";
  }

  return `${text.charAt(0)}${"*".repeat(Math.min(text.length - 1, 8))}`;
}

export function useProtectedFieldAccess(
  fieldCode?: string,
  fieldCodes?: readonly string[],
): FieldAccessLevel {
  const codes = normalizeFieldCodes(fieldCode, fieldCodes);

  return usePermissionStore((state) => {
    if (codes.length === 0) {
      return "edit";
    }

    return mostRestrictedAccess(codes.map((code) => state.getFieldAccess(code)));
  });
}

export function useProtectedFieldValue({
  fieldCode,
  fieldCodes,
  value,
  kind = "text",
  fallback = "—",
  hiddenLabel = "Restricted",
}: ProtectedFieldValueOptions): ProtectedFieldValue {
  const access = useProtectedFieldAccess(fieldCode, fieldCodes);

  if (access === "hidden") {
    return {
      access,
      displayValue: hiddenLabel,
      isRestricted: true,
      restrictionLabel: "Hidden by field access policy",
    };
  }

  if (access === "mask") {
    return {
      access,
      displayValue: maskValue(value, kind, fallback),
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

export function PermissionedFieldValue({
  fieldCode,
  fieldCodes,
  value,
  kind = "text",
  fallback = "—",
  hiddenLabel = "Restricted",
  withRestrictionTooltip = true,
  c,
  ...textProps
}: PermissionedFieldValueProps) {
  const protectedValue = useProtectedFieldValue({
    fieldCode,
    fieldCodes,
    value,
    kind,
    fallback,
    hiddenLabel,
  });

  const text = (
    <Text c={protectedValue.isRestricted ? "var(--mb-text-muted)" : c} {...textProps}>
      {protectedValue.displayValue}
    </Text>
  );

  if (!withRestrictionTooltip || !protectedValue.restrictionLabel) {
    return text;
  }

  return (
    <Tooltip label={protectedValue.restrictionLabel} withArrow>
      {text}
    </Tooltip>
  );
}
