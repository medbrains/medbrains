import { ActionIcon, Badge, Button, Group, Table, Text, Tooltip } from "@mantine/core";
import type { PharmacyCatalog, PrescriptionItemInput } from "@medbrains/types";
import { IconDeviceFloppy, IconPill, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { instructionsDisplayText } from "../../lib/medication-timing-utils";
import styles from "./prescription-writer.module.scss";

interface PrescriptionItemsTableProps {
  items: PrescriptionItemInput[];
  onRemoveItem: (index: number) => void;
  onSave: () => void;
  onOpenSaveTemplate: () => void;
  isSaving?: boolean;
  drugCatalog?: PharmacyCatalog[];
}

export function PrescriptionItemsTable({
  items,
  onRemoveItem,
  onSave,
  onOpenSaveTemplate,
  isSaving,
  drugCatalog = [],
}: PrescriptionItemsTableProps) {
  const { t } = useTranslation("clinical");

  if (items.length === 0) return null;

  return (
    <>
      <Table striped className={styles.pendingTable}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("prescription.drug")}</Table.Th>
            <Table.Th>{t("prescription.dosage")}</Table.Th>
            <Table.Th>{t("prescription.frequency")}</Table.Th>
            <Table.Th>{t("prescription.duration")}</Table.Th>
            <Table.Th>{t("prescription.route")}</Table.Th>
            <Table.Th>When to Take</Table.Th>
            <Table.Th w={40} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, idx) => {
            const timing = instructionsDisplayText(item.instructions ?? null);
            const catalogItem = item.catalog_item_id
              ? drugCatalog.find((drug) => drug.id === item.catalog_item_id)
              : undefined;
            const stockWarning = prescriptionStockWarning(catalogItem);
            return (
              <Table.Tr key={idx}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {item.drug_name}
                  </Text>
                  {stockWarning && (
                    <Tooltip label={stockWarning.message} multiline maw={320}>
                      <Badge size="xs" color={stockWarning.color} variant="light">
                        {stockWarning.label}
                      </Badge>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>{item.dosage}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {item.frequency}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.duration}</Table.Td>
                <Table.Td>{item.route ?? "—"}</Table.Td>
                <Table.Td>
                  {timing ? (
                    <Tooltip label={timing} multiline maw={300}>
                      <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 160 }}>
                        {timing}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="xs"
                    onClick={() => onRemoveItem(idx)}
                    aria-label="Close"
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end">
        <Button
          size="sm"
          variant="light"
          onClick={onOpenSaveTemplate}
          leftSection={<IconDeviceFloppy size={14} />}
        >
          Save as Template
        </Button>
        <Button size="sm" onClick={onSave} loading={isSaving} leftSection={<IconPill size={14} />}>
          {t("prescription.savePrescription")} ({t("prescription.items", { count: items.length })})
        </Button>
      </Group>
    </>
  );
}

function prescriptionStockWarning(drug: PharmacyCatalog | undefined) {
  if (!drug) {
    return null;
  }

  if (drug.current_stock <= 0) {
    return {
      color: "danger",
      label: "Out of stock warning",
      message:
        "Out of stock now. The prescription can still be saved; pharmacy will arrange stock, substitute, or partial-fill.",
    };
  }

  if (drug.reorder_level > 0 && drug.current_stock <= drug.reorder_level) {
    return {
      color: "warning",
      label: "Low stock warning",
      message: `Low stock. ${drug.current_stock} ${drug.unit ?? "units"} available in pharmacy.`,
    };
  }

  return null;
}
