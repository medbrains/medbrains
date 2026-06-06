import { Text, type TextProps, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { FieldAccessLevel } from "@medbrains/types";
import { mostRestrictedFieldAccess } from "@medbrains/utils";
import {
  type PermissionedFieldKind,
  type ProtectedFieldDisplay,
  resolveProtectedFieldDisplay,
} from "./field-access-display";

export type { PermissionedFieldKind } from "./field-access-display";

interface ProtectedFieldValueOptions {
  fieldCode?: string;
  fieldCodes?: readonly string[];
  value: number | string | null | undefined;
  kind?: PermissionedFieldKind;
  fallback?: string;
  hiddenLabel?: string;
}

interface PermissionedFieldValueProps
  extends ProtectedFieldValueOptions,
    Omit<TextProps, "children"> {
  withRestrictionTooltip?: boolean;
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

export function useProtectedFieldAccess(
  fieldCode?: string,
  fieldCodes?: readonly string[],
): FieldAccessLevel {
  const codes = normalizeFieldCodes(fieldCode, fieldCodes);

  return usePermissionStore((state) => {
    if (codes.length === 0) {
      return "edit";
    }

    return mostRestrictedFieldAccess(codes.map((code) => state.getFieldAccess(code)));
  });
}

export function useProtectedFieldValue({
  fieldCode,
  fieldCodes,
  value,
  kind = "text",
  fallback = "—",
  hiddenLabel = "Restricted",
}: ProtectedFieldValueOptions): ProtectedFieldDisplay {
  const access = useProtectedFieldAccess(fieldCode, fieldCodes);
  return resolveProtectedFieldDisplay({
    access,
    fallback,
    hiddenLabel,
    kind,
    value,
  });
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
