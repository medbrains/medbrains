import { Avatar } from "@mantine/core";
import { Image } from "@/components/ui";

interface HospitalLogoProps {
  /** Hospital display name — drives the initials placeholder. */
  name: string;
  /** Configured logo URL; when absent an initials placeholder is shown. */
  logoUrl?: string | null;
  size?: number;
  radius?: number;
}

/**
 * The hospital's own logo, with a graceful placeholder. When no logo is
 * configured we show the hospital's initials (NOT the MedBrains mark — that
 * belongs to the "by MedBrains" attribution, and reusing it here would
 * misrepresent the hospital's identity). Deterministic colour from the name.
 */
export function HospitalLogo({ name, logoUrl, size = 64, radius = 2 }: HospitalLogoProps) {
  const url = logoUrl?.trim();
  if (url) {
    return (
      <Image src={url} alt={name} w={size} h={size} fit="contain" radius={radius} loading="eager" />
    );
  }
  // Deterministic brand tint (not Mantine's per-name hashed colour) so every
  // hospital placeholder reads as one consistent brand mark.
  return (
    <Avatar
      name={name}
      size={size}
      radius={radius}
      alt={name}
      styles={{
        placeholder: {
          backgroundColor: "var(--mb-brand-bg)",
          color: "var(--mb-brand)",
          fontWeight: 700,
        },
      }}
    />
  );
}
