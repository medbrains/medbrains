// IPD RxBillingEstimate — split from pharmacy.tsx (pure move).

import { Card, Group, Loader, NumberInput, Stack, Text, Tooltip } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { PharmacyRxDetailItem, PharmacyRxReviewItemInput } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconLock,
  IconPencil,
  IconReceipt,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components";
import { IconButton, Table } from "@/components/ui";
import styles from "../pharmacy.module.scss";
import {
  canEditPharmacyField,
  canViewPharmacyField,
  renderPharmacySensitiveCurrency,
  rxReviewInputFromItem,
} from "./shared";

export function RxBillingEstimate({
  items,
  loading = false,
  editable = false,
  reviewItems,
  onReviewItemsChange,
}: {
  items: PharmacyRxDetailItem[];
  loading?: boolean;
  editable?: boolean;
  reviewItems?: PharmacyRxReviewItemInput[];
  onReviewItemsChange?: (items: PharmacyRxReviewItemInput[]) => void;
}) {
  const { t } = useTranslation("pharmacy");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const subtotal = items.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0);
  const tax = items.reduce((sum, item) => sum + Number(item.tax_amount || 0), 0);
  const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const unmatchedCount = items.filter((item) => item.price_source === "unmatched").length;
  const canViewAmounts = canViewPharmacyField(priceAccess);
  const canEdit = editable && Boolean(onReviewItemsChange) && canEditPharmacyField(priceAccess);

  function updateReviewLine(item: PharmacyRxDetailItem, patch: Partial<PharmacyRxReviewItemInput>) {
    if (!onReviewItemsChange) return;
    const current = reviewItems?.length ? reviewItems : items.map(rxReviewInputFromItem);
    const next = current.map((line) =>
      line.prescription_item_id === item.id
        ? {
            ...line,
            ...patch,
          }
        : line,
    );
    onReviewItemsChange(next);
  }

  if (loading) {
    return (
      <Card withBorder padding="sm" className={styles.rxEstimateCard}>
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            {t("rxBillingEstimate.calculating")}
          </Text>
        </Group>
      </Card>
    );
  }

  return (
    <Card withBorder padding="sm" className={styles.rxEstimateCard}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={700}>{t("rxBillingEstimate.title")}</Text>
          <Group gap={6}>
            <OperationalSignal
              icon={canViewAmounts ? IconReceipt : IconLock}
              label={
                canViewAmounts
                  ? t("rxBillingEstimate.signals.draftReady")
                  : t("rxBillingEstimate.signals.amountMasked")
              }
              shape={canViewAmounts ? "token" : "diamond"}
              size="xs"
              tone={canViewAmounts ? "active" : "blocked"}
            />
            {unmatchedCount > 0 && (
              <OperationalSignal
                icon={IconAlertTriangle}
                label={t("rxBillingEstimate.signals.unpriced", { count: unmatchedCount })}
                shape="diamond"
                size="xs"
                tone="blocked"
                value={String(unmatchedCount)}
              />
            )}
            {canEdit && (
              <OperationalSignal
                icon={IconPencil}
                label={t("rxBillingEstimate.signals.priceOverride")}
                shape="token"
                size="xs"
                tone="active"
              />
            )}
          </Group>
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("rxBillingEstimate.columns.drug")}</Table.Th>
              <Table.Th>{t("rxBillingEstimate.columns.qty")}</Table.Th>
              <Table.Th>{t("rxBillingEstimate.columns.unit")}</Table.Th>
              <Table.Th>{t("rxBillingEstimate.columns.gst")}</Table.Th>
              <Table.Th>{t("rxBillingEstimate.columns.tax")}</Table.Th>
              <Table.Th>{t("rxBillingEstimate.columns.total")}</Table.Th>
              {canEdit && <Table.Th>{t("rxBillingEstimate.columns.actions")}</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {item.drug_name}
                      </Text>
                      {item.price_source === "unmatched" && (
                        <Text size="xs" c="warning">
                          {t("rxBillingEstimate.unmatchedCatalog")}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <NumberInput
                        value={item.quantity}
                        min={1}
                        step={1}
                        allowDecimal={false}
                        hideControls
                        size="xs"
                        w={72}
                        onChange={(value) => {
                          const next =
                            typeof value === "number" ? value : Number.parseInt(value || "1", 10);
                          updateReviewLine(item, {
                            quantity: Number.isFinite(next) && next > 0 ? next : 1,
                          });
                        }}
                      />
                    ) : (
                      item.quantity
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <NumberInput
                        value={item.unit_price}
                        min={0}
                        decimalScale={2}
                        prefix="₹"
                        hideControls
                        size="xs"
                        w={110}
                        onChange={(value) => {
                          const next =
                            typeof value === "number" ? value : Number.parseFloat(value || "0");
                          updateReviewLine(item, {
                            unit_price: Number.isFinite(next) && next >= 0 ? next : 0,
                          });
                        }}
                      />
                    ) : (
                      renderPharmacySensitiveCurrency(priceAccess, item.unit_price)
                    )}
                  </Table.Td>
                  <Table.Td>{Number(item.tax_percent || 0).toFixed(2)}%</Table.Td>
                  <Table.Td>
                    {renderPharmacySensitiveCurrency(priceAccess, item.tax_amount)}
                  </Table.Td>
                  <Table.Td fw={700}>
                    {renderPharmacySensitiveCurrency(priceAccess, item.line_total)}
                  </Table.Td>
                  {canEdit && (
                    <Table.Td>
                      <Tooltip
                        label={
                          isEditing
                            ? t("rxBillingEstimate.actions.doneEditing")
                            : t("rxBillingEstimate.actions.editQuantityPrice")
                        }
                      >
                        <IconButton
                          size="sm"
                          tone={isEditing ? "primary" : "default"}
                          onClick={() => setEditingItemId(isEditing ? null : item.id)}
                          aria-label={t(
                            isEditing
                              ? "rxBillingEstimate.actions.saveDrug"
                              : "rxBillingEstimate.actions.editDrug",
                            { drug: item.drug_name },
                          )}
                        >
                          {isEditing ? <IconDeviceFloppy size={14} /> : <IconPencil size={14} />}
                        </IconButton>
                      </Tooltip>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" gap="lg" className={styles.billingSummaryBand}>
          <Text size="sm" c="dimmed">
            {t("rxBillingEstimate.summary.subtotal")}{" "}
            {renderPharmacySensitiveCurrency(priceAccess, subtotal)}
          </Text>
          <Text size="sm" c="dimmed">
            {t("rxBillingEstimate.summary.gst")} {renderPharmacySensitiveCurrency(priceAccess, tax)}
          </Text>
          <Text fw={800}>
            {t("rxBillingEstimate.summary.total")}{" "}
            {renderPharmacySensitiveCurrency(priceAccess, total)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  POS Counter Tab (Phase 3)
// ══════════════════════════════════════════════════════════
