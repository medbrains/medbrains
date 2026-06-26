import { Stack, Text } from "@mantine/core";
import { BrandMark } from "@/components/BrandMark";
import { PoweredBy } from "@/components/PoweredBy";
import { useTenantBrand } from "@/hooks/useTenantBrand";

type BrandSurface = "header" | "signin" | "footer";

/**
 * The single brand block, adapted per surface. It owns ALL the
 * hospital-vs-MedBrains logic (logo/placeholder, name, attribution) so pages
 * never branch on tenant identity — they just place `<Brand surface=… />`.
 *
 * - `header`  — app top bar: small mark + name + subtle "powered by" line.
 * - `signin`  — login hero: large mark + hospital name (branded only).
 * - `footer`  — login footer: the "by MedBrains" sign-off (branded only).
 */
export function Brand({ surface }: { surface: BrandSurface }) {
  const tenant = useTenantBrand();
  const displayName = tenant?.name || "MedBrains HMS";

  if (surface === "header") {
    return (
      <>
        <BrandMark size={30} radius={2} />
        <Stack gap={0} style={{ lineHeight: 1.05 }}>
          <Text size="sm" fw={600} c="var(--mb-text-primary)" style={{ letterSpacing: "-0.02em" }}>
            {displayName}
          </Text>
          {tenant && (
            <Text size="10px" c="var(--mb-text-secondary)">
              powered by MedBrains
            </Text>
          )}
        </Stack>
      </>
    );
  }

  if (surface === "signin") {
    return (
      <Stack align="center" gap="xs">
        <BrandMark size={64} radius={2} />
        {tenant && (
          <Text size="xl" fw={700} c="var(--mb-text-primary)" ta="center">
            {displayName}
          </Text>
        )}
      </Stack>
    );
  }

  // footer
  return tenant ? <PoweredBy /> : null;
}
