import { Badge, Grid, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconFingerprint, IconShieldCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";

export type AbhaLinkStatus = "manual" | "ready" | "linked" | "verified" | "unavailable";

export interface AbhaLinkPanelProps {
  numberField: ReactNode;
  addressField: ReactNode;
  status?: AbhaLinkStatus;
  /** Opens "Verify ABHA"; absent for staff who may not verify. */
  onVerify?: () => void;
  /** Opens "Create ABHA" (by Aadhaar OTP) for a patient who has none. */
  onCreate?: () => void;
  /** Opens the ABHA card to print, while ABDM's session for the patient lasts. */
  onPrintCard?: () => void;
}

interface StatusMeta {
  label: string;
  color: string;
}

const statusMeta: Record<AbhaLinkStatus, StatusMeta> = {
  manual: { label: "Manual", color: "gray" },
  ready: { label: "Ready", color: "blue" },
  linked: { label: "Linked", color: "teal" },
  verified: { label: "Verified with ABDM", color: "green" },
  unavailable: { label: "Unavailable", color: "yellow" },
};

export function AbhaLinkPanel({
  numberField,
  addressField,
  status = "manual",
  onVerify,
  onCreate,
  onPrintCard,
}: AbhaLinkPanelProps) {
  const meta = statusMeta[status];
  const badgeIcon =
    status === "verified" || status === "linked" ? <IconShieldCheck size={12} /> : null;

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" gap="xs">
        <Group gap="xs" align="center">
          <ThemeIcon color={meta.color} variant="light" size="sm" radius="xl">
            <IconFingerprint size={14} />
          </ThemeIcon>
          <Text size="sm" fw={650}>
            ABDM identity
          </Text>
        </Group>
        <Group gap="xs">
          <Badge color={meta.color} variant="light" leftSection={badgeIcon}>
            {meta.label}
          </Badge>
          {status === "verified" && onPrintCard && (
            <Button tone="ghost" size="xs" onClick={onPrintCard}>
              Print ABHA card
            </Button>
          )}
          {onCreate && status !== "verified" && (
            <Button tone="ghost" size="xs" onClick={onCreate}>
              Create ABHA
            </Button>
          )}
          {onVerify && (
            <Button tone="secondary" size="xs" onClick={onVerify}>
              {status === "verified" ? "Verify again" : "Verify ABHA"}
            </Button>
          )}
        </Group>
      </Group>
      <Grid gap="sm">
        <Grid.Col span={{ base: 12, sm: 5 }}>{numberField}</Grid.Col>
        <Grid.Col span={{ base: 12, sm: 7 }}>{addressField}</Grid.Col>
      </Grid>
    </Stack>
  );
}
