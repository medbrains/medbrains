/**
 * One counter's business day: the Z-report, then either the cash count that
 * closes it, why it cannot be closed yet, or the close on record.
 */
import { Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DayCloseRow, DayReport, FieldAccessLevel } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Modal, Table, TextArea } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { DayCloseForm } from "./day-close-form";
import { financeAmountText } from "./shared";

interface DayClosePanelProps {
  locationId: string;
  businessDate: string;
  amountAccess: FieldAccessLevel;
}

export function DayClosePanel({ locationId, businessDate, amountAccess }: DayClosePanelProps) {
  const canClose = useHasPermission(P.PHARMACY.DAY_CLOSE_CLOSE);
  const day = useQuery({
    queryKey: ["pharmacy-day-close", "report", locationId, businessDate],
    queryFn: () =>
      pharmacyFinanceService.getDayCloseReport({
        pharmacy_location_id: locationId,
        business_date: businessDate,
      }),
  });
  const money = (v: string | number | null | undefined) => financeAmountText(amountAccess, v);

  if (day.isPending) return <Loader size="sm" />;
  if (day.isError) {
    return (
      <Alert tone="danger" role="alert" title="Could not load this day">
        {day.error.message}
      </Alert>
    );
  }
  const { report, close, close_refusal: refusal } = day.data;
  const closed = close?.status === "closed";

  return (
    <Stack gap="md">
      <ZSummary data={day.data} money={money} />
      {report.summary.sales_without_drawer > 0 && (
        <Alert tone="warning">
          {report.summary.sales_without_drawer} card or UPI sale(s) that day were rung with no
          drawer open. No counter can claim them, so they are not in this report.
        </Alert>
      )}
      {close && <CloseRecord close={close} money={money} />}
      {!closed && refusal && <Alert tone="info">{refusal}</Alert>}
      {!closed && !refusal && canClose && (
        <DayCloseForm
          locationId={locationId}
          businessDate={businessDate}
          expectedCash={Number(report.summary.expected_cash)}
          onClosed={() => void day.refetch()}
        />
      )}
    </Stack>
  );
}

type Money = (v: string | number | null | undefined) => string;

function ZSummary({ data, money }: { data: DayReport; money: Money }) {
  const { summary, tenders, drawers } = data.report;
  const stats: Array<[string, string]> = [
    [`Sales (${summary.sales_count})`, money(summary.sales_total)],
    ["Discounts", money(summary.discount_total)],
    ["GST collected", money(summary.gst_total)],
    [`Returns (${summary.returns_count})`, money(summary.returns_total)],
    ["Petty cash paid out", money(summary.petty_cash_total)],
    ["Cash the drawers should hold", money(summary.expected_cash)],
  ];
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        {stats.map(([label, value]) => (
          <Card key={label} padding="sm" withBorder>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            <Text fw={700}>{value}</Text>
          </Card>
        ))}
      </SimpleGrid>
      <Table aria-label="Takings by tender">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tender</Table.Th>
            <Table.Th>Collected</Table.Th>
            <Table.Th>Refunded</Table.Th>
            <Table.Th>Net</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tenders.map((t) => (
            <Table.Tr key={t.mode}>
              <Table.Td>{t.mode.toUpperCase()}</Table.Td>
              <Table.Td>{money(t.collected)}</Table.Td>
              <Table.Td>{money(t.refunded)}</Table.Td>
              <Table.Td>{money(t.net)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Table aria-label="Drawers that day">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Cashier</Table.Th>
            <Table.Th>Drawer</Table.Th>
            <Table.Th>Float</Table.Th>
            <Table.Th>Should hold</Table.Th>
            <Table.Th>Counted</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {drawers.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.cashier_name ?? "—"}</Table.Td>
              <Table.Td>
                <Badge tone={d.status === "open" ? "warning" : "neutral"}>
                  {d.status === "open" ? "Still open" : d.status.replaceAll("_", " ")}
                </Badge>
              </Table.Td>
              <Table.Td>{money(d.opening_float)}</Table.Td>
              <Table.Td>{money(d.expected_cash)}</Table.Td>
              <Table.Td>{money(d.actual_close_amount)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function CloseRecord({ close, money }: { close: DayCloseRow; money: Money }) {
  const canReopen = useHasPermission(P.PHARMACY.DAY_CLOSE_REOPEN);
  const [reopening, setReopening] = useState(false);
  const variance = Number(close.variance);
  return (
    <Card padding="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={700}>
            {close.status === "closed" ? "Closed" : "Reopened"} ·{" "}
            {new Date(close.closed_at).toLocaleString()}
          </Text>
          {close.status === "closed" && canReopen && (
            <Button tone="danger-tertiary" size="xs" onClick={() => setReopening(true)}>
              Reopen day
            </Button>
          )}
        </Group>
        <Text size="sm">
          Counted {money(close.counted_cash)} against {money(close.expected_cash)} by{" "}
          {close.closed_by_name ?? "—"}.{" "}
          {variance === 0
            ? "No difference."
            : `${variance > 0 ? "Over" : "Short"} by ${money(Math.abs(variance).toFixed(2))}: ${close.variance_reason ?? ""}`}
        </Text>
        <Text size="sm">
          Float kept {money(close.float_carried_forward)} · deposited{" "}
          {money((Number(close.counted_cash) - Number(close.float_carried_forward)).toFixed(2))}
        </Text>
        {close.status === "reopened" && (
          <Alert tone="warning" title={`Reopened by ${close.reopened_by_name ?? "—"}`}>
            {close.reopen_reason}. Count it again to close it.
          </Alert>
        )}
      </Stack>
      <ReopenModal close={close} opened={reopening} onClose={() => setReopening(false)} />
    </Card>
  );
}

function ReopenModal({
  close,
  opened,
  onClose,
}: {
  close: DayCloseRow;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const reopen = useMutation({
    mutationFn: () => pharmacyFinanceService.reopenCounterDay(close.id, { reason: reason.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-day-close"] });
      setReason("");
      onClose();
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={`Reopen ${close.business_date}`}>
      <Stack gap="sm">
        <Text size="sm">
          Sales, returns and voids can be dated to the day again until it is counted and closed once
          more. Your name and reason are recorded.
        </Text>
        <TextArea
          label="Why reopen it?"
          required
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        {reopen.isError && (
          <Alert tone="danger" role="alert">
            {reopen.error.message}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="danger"
            loading={reopen.isPending}
            disabled={reason.trim().length < 5}
            onClick={() => reopen.mutate()}
          >
            Reopen day
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
