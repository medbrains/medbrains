import { Image, Stack, Text } from "@mantine/core";

/**
 * Open-source attribution — the MedBrains pulse mark with a small secondary
 * caption beneath it ("by MedBrains"). Deliberately quiet: the hospital's own
 * brand leads; this is a subtle attached sign-off, not a banner. Shown on the
 * sign-in page (white-label) and anywhere the hospital brand is primary.
 */
export function PoweredBy() {
  return (
    <Stack align="center" gap={3}>
      <Image src="/logo/medbrains-mark.svg" alt="" w={18} h={18} fit="contain" loading="lazy" />
      <Text size="10px" c="var(--mb-text-secondary)" style={{ letterSpacing: "0.02em" }}>
        by MedBrains
      </Text>
    </Stack>
  );
}
