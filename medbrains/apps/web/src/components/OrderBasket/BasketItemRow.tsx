import { ActionIcon, Badge, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { BasketItem, BasketWarning } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { instructionsDisplayText } from "../../lib/medication-timing-utils";
import { DrugRxComposer } from "../inputs/DrugRxComposer";

interface BasketItemRowProps {
  item: BasketItem;
  index: number;
  warnings: BasketWarning[];
  onRemove: () => void;
}

export function BasketItemRow({ item, index, warnings, onRemove }: BasketItemRowProps) {
  const canRemoveDrug = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canRemoveLab = useHasPermission(P.LAB.ORDERS_CREATE);
  const canRemoveRadiology = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canRemoveProcedure = useHasPermission(P.OPD.PROCEDURES.CREATE);
  const canRemoveDiet = useHasPermission(P.DIET.ORDERS_CREATE);
  const canRemoveReferral = useHasPermission(P.OPD.REFERRALS.CREATE);
  const hasBlock = warnings.some((w) => w.severity === "BLOCK");
  const hasWarn = warnings.some((w) => w.severity === "WARN");
  const canRemoveItem =
    item.kind === "drug"
      ? canRemoveDrug
      : item.kind === "lab"
        ? canRemoveLab
        : item.kind === "radiology"
          ? canRemoveRadiology
          : item.kind === "procedure"
            ? canRemoveProcedure
            : item.kind === "diet"
              ? canRemoveDiet
              : canRemoveReferral;

  const borderColor = hasBlock
    ? "var(--mantine-color-red-6)"
    : hasWarn
      ? "var(--mantine-color-yellow-6)"
      : "var(--mantine-color-default-border)";

  return (
    <Card
      withBorder
      padding="xs"
      style={{
        borderColor,
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs">
            <Badge size="xs" variant="light">
              {item.kind}
            </Badge>
            <Text size="xs" c="dimmed">
              #{index + 1}
            </Text>
            {(hasBlock || hasWarn) && (
              <Tooltip label={warnings.map((w) => w.message).join("\n")} multiline w={280}>
                <Badge
                  color={hasBlock ? "red" : "yellow"}
                  size="xs"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  {hasBlock ? "BLOCK" : "WARN"} ({warnings.length})
                </Badge>
              </Tooltip>
            )}
          </Group>
          {item.kind === "drug" ? (
            <DrugRxComposer
              rx={{
                drug: item.drug_name,
                dose: item.dose,
                freq: item.frequency,
                duration: item.duration_days != null ? `${item.duration_days} days` : "duration",
                instruction:
                  instructionsDisplayText(item.instructions) ?? item.indication ?? undefined,
              }}
            />
          ) : (
            <Text size="sm" fw={500} truncate>
              {summarizeItem(item)}
            </Text>
          )}
          <Text size="xs" c="dimmed" truncate>
            {detailLine(item)}
          </Text>
        </Stack>
        {canRemoveItem && (
          <Tooltip label="Remove basket item">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={onRemove}
              aria-label={`Remove ${item.kind} item ${index + 1}`}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Card>
  );
}

function summarizeItem(item: BasketItem): string {
  switch (item.kind) {
    case "drug":
      return `${item.drug_name} — ${item.dose} ${item.frequency} × ${item.duration_days ?? "?"}d`;
    case "lab":
      return `Lab order (${item.priority ?? "routine"})`;
    case "radiology":
      return `${item.body_part ?? "imaging"} (${item.priority ?? "routine"})`;
    case "procedure":
      return `Procedure`;
    case "diet":
      return `${item.diet_type ?? "diet"} order${item.is_npo ? " (NPO)" : ""}`;
    case "referral":
      return `Referral — ${item.reason}`;
  }
}

function detailLine(item: BasketItem): string {
  switch (item.kind) {
    case "drug":
      return `qty ${item.quantity} @ ₹${item.unit_price}${item.indication ? ` • ${item.indication}` : ""}`;
    case "lab":
      return item.indication ?? item.notes ?? "—";
    case "radiology":
      return item.clinical_indication ?? item.notes ?? "—";
    case "procedure":
      return item.indication ?? "—";
    case "diet":
      return item.special_instructions ?? "—";
    case "referral":
      return item.priority ?? "routine";
  }
}
