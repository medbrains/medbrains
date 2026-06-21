import { Stack, Text } from "@mantine/core";
import type { TenantSettingsRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { tenantSettingsService } from "@/services/tenantSettings.service";

function brandValue(rows: TenantSettingsRow[], key: string): string {
  const row = rows.find((r) => r.key === key);
  return typeof row?.value === "string" ? row.value : "";
}

/**
 * Header brand — the hospital's own name (from the branding config panel),
 * with a small "powered by MedBrains" white-label line. Falls back to the
 * MedBrains mark + name when no branding is configured.
 */
export function BrandLogo() {
  const { data: rows = [] } = useQuery({
    queryKey: ["setup-branding"],
    queryFn: () => tenantSettingsService.getBranding(),
    staleTime: 600_000,
    retry: false,
  });

  const displayName = brandValue(rows, "display_name").trim() || "MedBrains HMS";
  const logoUrl = brandValue(rows, "logo_url").trim() || "/logo/medbrains-mark.svg";
  const isDefaultBrand = displayName === "MedBrains HMS";

  return (
    <>
      <img
        src={logoUrl}
        alt=""
        width={30}
        height={30}
        style={{ borderRadius: 3, objectFit: "contain" }}
      />
      <Stack gap={0} style={{ lineHeight: 1.05 }}>
        <Text size="sm" fw={600} c="var(--mb-text-primary)" style={{ letterSpacing: "-0.02em" }}>
          {displayName}
        </Text>
        {!isDefaultBrand && (
          <Text size="9px" c="var(--mb-text-muted)">
            powered by MedBrains
          </Text>
        )}
      </Stack>
    </>
  );
}
