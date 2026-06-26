import { HospitalLogo } from "@/components/HospitalLogo";
import { Image } from "@/components/ui";
import { useTenantBrand } from "@/hooks/useTenantBrand";

interface BrandMarkProps {
  size?: number;
  radius?: number;
}

/**
 * The deployment's primary mark — the hospital's logo (or an initials
 * placeholder) when the deployment is branded, else the MedBrains mark. This is
 * the single place that decides hospital-vs-MedBrains; render it anywhere a
 * logo is needed instead of re-checking the tenant brand inline.
 */
export function BrandMark({ size = 32, radius = 2 }: BrandMarkProps) {
  const tenant = useTenantBrand();
  if (tenant) {
    return (
      <HospitalLogo name={tenant.name} logoUrl={tenant.logo_url} size={size} radius={radius} />
    );
  }
  return (
    <Image
      src="/logo/medbrains-mark.svg"
      alt=""
      w={size}
      h={size}
      fit="contain"
      radius={radius}
      loading="eager"
    />
  );
}
