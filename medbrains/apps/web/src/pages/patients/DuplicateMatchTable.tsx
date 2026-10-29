import { Group, Stack, Text } from "@mantine/core";
import type { MpiMatchBand, MpiMatchResult } from "@medbrains/types";
import { IconEye } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, IconButton } from "@/components/ui";
import { PharmacyCustomerMatch } from "./pharmacy-customer-match";

interface DuplicateMatchTableProps {
  matches: MpiMatchResult[];
  onOpen: (match: MpiMatchResult) => void;
  onCompleted: () => void;
}

const BAND_TONE: Record<MpiMatchBand, BadgeTone> = {
  certain: "danger",
  likely: "danger",
  review: "warning",
};

/**
 * The registration desk's duplicate candidates: how sure the check is (its
 * band, never a bare percentage) and why, field by field, so the registrar
 * can tell "Laxmi" for "Lakshmi" from a twin sharing the family's mobile.
 */
export function DuplicateMatchTable({ matches, onOpen, onCompleted }: DuplicateMatchTableProps) {
  const { t } = useTranslation("patients");
  return (
    <DataTable
      columns={[
        {
          key: "uhid",
          label: t("uhid"),
          render: (m: MpiMatchResult) => (
            <Text size="sm" fw={500}>
              {m.uhid}
            </Text>
          ),
        },
        {
          key: "name",
          label: t("name"),
          render: (m: MpiMatchResult) => (
            <Text size="sm">
              {m.first_name} {m.last_name}
            </Text>
          ),
        },
        {
          key: "phone",
          label: t("phone"),
          render: (m: MpiMatchResult) => <Text size="sm">{m.phone || "—"}</Text>,
        },
        {
          key: "band",
          label: t("match.why"),
          render: (m: MpiMatchResult) => {
            const band = m.band ?? "review";
            return (
              <Stack gap={2}>
                <Badge size="sm" tone={BAND_TONE[band]}>
                  {t(`match.band.${band}`)}
                </Badge>
                {(m.reasons ?? []).map((r) => (
                  <Text key={r} size="xs" c="var(--mb-text-secondary)">
                    {r}
                  </Text>
                ))}
              </Stack>
            );
          },
        },
        {
          key: "actions",
          label: "",
          render: (m: MpiMatchResult) => (
            <Group gap="xs" wrap="nowrap">
              <PharmacyCustomerMatch match={m} onCompleted={onCompleted} />
              <IconButton size={44} aria-label={t("aria.viewDetails")} onClick={() => onOpen(m)}>
                <IconEye size={16} />
              </IconButton>
            </Group>
          ),
        },
      ]}
      data={matches}
      rowKey={(m) => m.id}
    />
  );
}
