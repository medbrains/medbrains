import { Group, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PatientAdvance } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCash, IconListCheck, IconReceipt, IconWallet } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader, PatientSearchSelect } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { billsDue, rupees } from "@/components/payments/collect/collect-math";
import { useCollect } from "@/components/payments/collect/collect-store";
import { LANE_LABEL, useDues } from "@/components/payments/collect/use-dues";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { billingInvoicePaymentRoute } from "./billing-workspace";

const COUNTER_KEY = "billing.counter";

function readCounter(): string {
  try {
    return localStorage.getItem(COUNTER_KEY) ?? "";
  } catch {
    return "";
  }
}

function AdvanceSummary({ advances }: { advances: PatientAdvance[] }) {
  const totalBalance = advances.reduce((sum, advance) => sum + Number(advance.balance), 0);
  if (totalBalance <= 0) return null;
  return (
    <Card withBorder>
      <Group gap="xs">
        <IconWallet size={16} />
        <Text size="sm" fw={600}>
          Deposit balance
        </Text>
        <Badge tone="success" ff="monospace">
          {rupees(totalBalance)}
        </Badge>
      </Group>
    </Card>
  );
}

/** The cashier's counter: find the patient, see every open bill, collect in one drawer. */
export function BillingCounterPage() {
  useRequirePermission(P.BILLING.PAYMENTS_CREATE);
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const navigate = useNavigate();
  const open = useCollect((s) => s.open);
  const [patientId, setPatientId] = useState("");
  // Day close still tallies by this label; remembered for the shift.
  const [counterId, setCounterId] = useState(readCounter);
  const onCounterChange = (value: string) => {
    setCounterId(value);
    try {
      localStorage.setItem(COUNTER_KEY, value);
    } catch {
      // Private window: the label holds for this page only.
    }
  };

  const dues = useDues(patientId || null);
  const advancesQuery = useQuery({
    queryKey: ["counter-advances", patientId],
    queryFn: () => billingService.listAdvances({ patient_id: patientId }),
    enabled: patientId.length > 0,
  });
  const bills = dues.data?.bills ?? [];
  const collectable = bills.filter((b) => b.can_collect);

  return (
    <Stack>
      <PageHeader
        title="Cashier counter"
        subtitle="Search a patient, collect every department's dues in one go."
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
        actions={
          <Group gap="xs">
            <Button
              tone="ghost"
              leftSection={<IconListCheck size={16} />}
              onClick={() => navigate("/billing/worklist")}
            >
              Worklist
            </Button>
            <Button tone="ghost" onClick={() => navigate("/billing")}>
              Back office
            </Button>
          </Group>
        }
      />

      <Card withBorder>
        <Group align="flex-end" gap="sm">
          <PatientSearchSelect
            value={patientId}
            onChange={setPatientId}
            label="Patient"
            placeholder="Search by name, UHID, or phone…"
            size="md"
          />
          <Input
            label="Counter"
            placeholder="e.g. OPD-1"
            value={counterId}
            onChange={(e) => onCounterChange(e.currentTarget.value)}
            w={140}
          />
        </Group>
      </Card>

      {patientId && (
        <>
          <PatientContextBanner patientId={patientId} variant="financial" />
          <AdvanceSummary advances={advancesQuery.data ?? []} />

          <Card withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={6}>Open bills</Title>
                <Group gap="xs">
                  {canCreate && (
                    <Button
                      size="xs"
                      tone="secondary"
                      onClick={() => navigate(`/billing?patient_id=${patientId}`)}
                    >
                      New invoice
                    </Button>
                  )}
                  {collectable.length > 0 && (
                    <Button
                      size="xs"
                      tone="primary"
                      leftSection={<IconCash size={14} />}
                      onClick={() => open({ patientId })}
                    >
                      Collect {rupees(billsDue(collectable))}
                    </Button>
                  )}
                </Group>
              </Group>

              {dues.isError && (
                <Alert tone="danger" title="Open bills could not be read">
                  {dues.error.message}
                </Alert>
              )}
              {dues.isLoading && <Text c="dimmed">Loading…</Text>}
              {dues.data && bills.length === 0 && (
                <Alert tone="info">
                  Nothing is due from this patient. Use “New invoice” to start one.
                </Alert>
              )}

              {bills.map((bill) => (
                <Card key={bill.invoice_id} withBorder padding="sm" data-testid="row-counter-bill">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Text fw={700}>{bill.invoice_number}</Text>
                        <Badge size="xs" tone="warning">
                          {bill.status}
                        </Badge>
                        {bill.entity_name && (
                          <Badge size="xs" tone="neutral">
                            {bill.entity_name}
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed">
                        {bill.lanes.map((l) => LANE_LABEL[l] ?? l).join(" + ")} · Total{" "}
                        {rupees(Number(bill.total_amount))} · Paid{" "}
                        {rupees(Number(bill.paid_amount))} · Balance {rupees(Number(bill.balance))}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        tone="ghost"
                        onClick={() => navigate(billingInvoicePaymentRoute(bill.invoice_id))}
                      >
                        Open
                      </Button>
                      {bill.can_collect && (
                        <Button
                          size="xs"
                          tone="secondary"
                          leftSection={<IconCash size={14} />}
                          onClick={() =>
                            open({
                              patientId,
                              invoiceIds: [bill.invoice_id],
                              focusLabel: "This bill",
                            })
                          }
                        >
                          Collect
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}
