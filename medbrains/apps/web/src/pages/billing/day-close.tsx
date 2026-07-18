// Billing DayCloseTab — split from billing.tsx (pure move).

import {
  Card,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CreateDayCloseRequest, DayEndClose } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Table, toast } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";
import { money, toBadgeTone } from "./shared";

// Indian currency note/coin denominations, high to low.
const CASH_DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

function DenominationGrid({
  counts,
  onChange,
}: {
  counts: Record<string, number>;
  onChange: (denom: number, count: number) => void;
}) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        Cash denomination count
      </Text>
      <Table withTableBorder={false} verticalSpacing={2}>
        <Table.Tbody>
          {CASH_DENOMINATIONS.map((denom) => {
            const count = counts[String(denom)] ?? 0;
            return (
              <Table.Tr key={denom}>
                <Table.Td w={70}>
                  <Text size="sm" ff="monospace">
                    ₹{denom}
                  </Text>
                </Table.Td>
                <Table.Td w={110}>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={count}
                    hideControls
                    onChange={(value) =>
                      onChange(denom, Math.max(0, Math.floor(Number(value) || 0)))
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" ff="monospace">
                    = ₹{money(denom * count)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

export function DayCloseTab() {
  const queryClient = useQueryClient();
  const canVerify = useHasPermission(P.BILLING.DAY_CLOSE_VERIFY);
  const [showForm, setShowForm] = useState(false);
  const [closeDate, setCloseDate] = useState(todayIso());
  const [counterId, setCounterId] = useState("");
  const [shift, setShift] = useState("");
  const [denomCounts, setDenomCounts] = useState<Record<string, number>>({});
  const [actualCard, setActualCard] = useState<number | string>(0);
  const [actualUpi, setActualUpi] = useState<number | string>(0);
  const [notes, setNotes] = useState("");
  const [verifyTarget, setVerifyTarget] = useState<DayEndClose | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");

  const countedCash = CASH_DENOMINATIONS.reduce(
    (sum, denom) => sum + denom * (denomCounts[String(denom)] ?? 0),
    0,
  );

  const resetForm = () => {
    setCloseDate(todayIso());
    setCounterId("");
    setShift("");
    setDenomCounts({});
    setActualCard(0);
    setActualUpi(0);
    setNotes("");
  };

  const { data: dayCloses = [], isLoading } = useQuery({
    queryKey: ["day-closes"],
    queryFn: () => billingService.listDayCloses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDayCloseRequest) => billingService.createDayClose(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setShowForm(false);
      resetForm();
      toast.success("Tally recorded.", { title: "Day closed" });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Error" }),
  });

  const submitDayClose = () => {
    createMutation.mutate({
      close_date: closeDate.trim(),
      actual_cash: countedCash,
      notes: notes.trim() || undefined,
      counter_id: counterId.trim() || undefined,
      shift: shift.trim() || undefined,
      denominations: Object.fromEntries(
        Object.entries(denomCounts).filter(([, count]) => count > 0),
      ),
      actual_card: typeof actualCard === "number" ? actualCard : Number(actualCard) || 0,
      actual_upi: typeof actualUpi === "number" ? actualUpi : Number(actualUpi) || 0,
    });
  };

  const verifyMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      billingService.verifyDayClose(id, { verification_notes: note.trim() || undefined }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setVerifyTarget(null);
      setVerifyNotes("");
      if (result.status === "verified") {
        toast.success("Tally balanced and signed off.", { title: "Verified" });
      } else {
        toast.warning("Variance recorded for follow-up.", { title: "Logged as discrepancy" });
      }
    },
  });

  const varianceText = (value: string) => {
    const diff = Number(value);
    return (
      <Text size="sm" fw={600} c={diff === 0 ? "success" : "danger"} ff="monospace">
        {diff > 0 ? "+" : ""}₹{money(value)}
      </Text>
    );
  };

  const columns = [
    {
      key: "close_date",
      label: "Date",
      sortable: true,
      searchable: true,
      sortValue: (row: DayEndClose) => new Date(row.close_date).getTime(),
      accessor: (row: DayEndClose) => row.close_date,
      render: (row: DayEndClose) => (
        <Stack gap={0}>
          <Text fw={600} size="sm">
            {row.close_date}
          </Text>
          {(row.counter_id || row.shift) && (
            <Text size="xs" c="dimmed">
              {[row.counter_id, row.shift].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "cash",
      label: "Cash (exp / act)",
      render: (row: DayEndClose) => (
        <Text size="sm" ff="monospace">
          ₹{money(row.expected_cash)} / ₹{money(row.actual_cash)}
        </Text>
      ),
    },
    {
      key: "cash_difference",
      label: "Cash Δ",
      render: (row: DayEndClose) => varianceText(row.cash_difference),
    },
    {
      key: "card_difference",
      label: "Card Δ",
      render: (row: DayEndClose) => varianceText(row.card_difference),
    },
    {
      key: "upi_difference",
      label: "UPI Δ",
      render: (row: DayEndClose) => varianceText(row.upi_difference),
    },
    {
      key: "total_collected",
      label: "Collected",
      sortable: true,
      sortValue: (row: DayEndClose) => Number(row.total_collected),
      accessor: (row: DayEndClose) => row.total_collected,
      render: (row: DayEndClose) => (
        <Text size="sm" ff="monospace">
          ₹{money(row.total_collected)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: DayEndClose) => row.status,
      render: (row: DayEndClose) => (
        <Badge tone={toBadgeTone(statusColor(row.status))}>{row.status}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DayEndClose) =>
        row.status === "open" && canVerify ? (
          <Button
            tone="secondary"
            size="compact-xs"
            leftSection={<IconCheck size={14} />}
            onClick={() => {
              setVerifyTarget(row);
              setVerifyNotes("");
            }}
          >
            Verify
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group>
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
        >
          {showForm ? "Cancel" : "Create day close"}
        </Button>
      </Group>

      {showForm && (
        <Card withBorder>
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="Close date"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.currentTarget.value)}
              />
              <TextInput
                label="Counter"
                placeholder="e.g. OPD-1"
                value={counterId}
                onChange={(e) => setCounterId(e.currentTarget.value)}
              />
              <TextInput
                label="Shift"
                placeholder="e.g. Morning"
                value={shift}
                onChange={(e) => setShift(e.currentTarget.value)}
              />
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <DenominationGrid
                counts={denomCounts}
                onChange={(denom, count) =>
                  setDenomCounts((prev) => ({ ...prev, [String(denom)]: count }))
                }
              />
              <Stack gap="sm">
                <Card withBorder bg="var(--fc-panel, #f7f8f6)">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Counted cash
                    </Text>
                    <Text size="lg" fw={700} ff="monospace">
                      ₹{money(countedCash)}
                    </Text>
                  </Group>
                </Card>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Settlement report (card / UPI)
                </Text>
                <NumberInput
                  label="Card settled (POS batch)"
                  min={0}
                  decimalScale={2}
                  value={actualCard}
                  onChange={setActualCard}
                />
                <NumberInput
                  label="UPI settled (bank report)"
                  min={0}
                  decimalScale={2}
                  value={actualUpi}
                  onChange={setActualUpi}
                />
                <Textarea
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                />
                <Button tone="primary" loading={createMutation.isPending} onClick={submitDayClose}>
                  Submit day close · counted ₹{money(countedCash)}
                </Button>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={dayCloses}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search by close date"
        exportable
        exportFileName="day-end-close"
      />

      <Modal
        opened={verifyTarget !== null}
        onClose={() => setVerifyTarget(null)}
        title="Verify day close"
        size="md"
      >
        {verifyTarget && (
          <Stack gap="sm">
            <Text size="sm">
              {verifyTarget.close_date}
              {verifyTarget.counter_id ? ` · ${verifyTarget.counter_id}` : ""} — cash variance{" "}
              <Text
                span
                fw={700}
                c={Number(verifyTarget.cash_difference) === 0 ? "success" : "danger"}
              >
                ₹{money(verifyTarget.cash_difference)}
              </Text>
              . Verifying balanced totals signs off; any variance is logged as a discrepancy.
            </Text>
            <Textarea
              label="Verification notes"
              placeholder="Explain any variance (denomination miscount, pending UPI, …)"
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button tone="ghost" onClick={() => setVerifyTarget(null)}>
                Cancel
              </Button>
              <Button
                tone="primary"
                loading={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ id: verifyTarget.id, note: verifyNotes })}
              >
                Sign off
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────
