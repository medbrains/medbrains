import { Alert, Badge, Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { Invoice, PatientAdvance } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCash, IconListCheck, IconReceipt, IconWallet } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader, PatientSearchSelect, PaymentCollectPanel } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { billingInvoicePaymentRoute } from "./billing-workspace";

function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function invoiceBalance(invoice: Invoice): number {
  return Number(invoice.total_amount) - Number(invoice.paid_amount);
}

/** A counter-paced collect panel: keyboard-first, mixed-mode split. */
function CollectPanel({
  invoice,
  onCollected,
  counterId,
}: {
  invoice: Invoice;
  onCollected: () => void;
  counterId: string;
}) {
  return (
    <Card withBorder bg="var(--fc-panel, #f7f8f6)">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Collect for {invoice.invoice_number}
          </Text>
          <Text size="sm" c="dimmed">
            Balance ₹{money(invoiceBalance(invoice))}
          </Text>
        </Group>
        <PaymentCollectPanel
          invoiceId={invoice.id}
          balance={invoiceBalance(invoice)}
          onRecorded={onCollected}
          counterId={counterId}
          autoFocus
        />
      </Stack>
    </Card>
  );
}

function AdvanceSummary({ advances }: { advances: PatientAdvance[] }) {
  const totalBalance = advances.reduce((sum, advance) => sum + Number(advance.balance), 0);
  if (totalBalance <= 0) return null;
  return (
    <Card withBorder>
      <Group gap="xs">
        <IconWallet size={16} />
        <Text size="sm" fw={600}>
          Advance balance
        </Text>
        <Badge color="success" variant="light" ff="monospace">
          ₹{money(totalBalance)}
        </Badge>
      </Group>
    </Card>
  );
}

export function BillingCounterPage() {
  useRequirePermission(P.BILLING.PAYMENTS_CREATE);
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  // Active counter label tags every payment for the day-close tally;
  // persisted so the cashier sets it once per shift.
  const [counterId, setCounterId] = useState(() => localStorage.getItem("billing.counter") ?? "");
  const onCounterChange = (value: string) => {
    setCounterId(value);
    localStorage.setItem("billing.counter", value);
  };

  const invoicesQuery = useQuery({
    queryKey: ["counter-invoices", patientId],
    queryFn: () => billingService.listInvoices({ patient_id: patientId, per_page: "50" }),
    enabled: patientId.length > 0,
  });

  const advancesQuery = useQuery({
    queryKey: ["counter-advances", patientId],
    queryFn: () => billingService.listAdvances({ patient_id: patientId }),
    enabled: patientId.length > 0,
  });

  const openInvoices = useMemo(
    () =>
      (invoicesQuery.data?.invoices ?? []).filter(
        (invoice) =>
          (invoice.status === "issued" || invoice.status === "partially_paid") &&
          invoiceBalance(invoice) > 0,
      ),
    [invoicesQuery.data],
  );

  const onCollected = (invoiceId: string) => {
    setCollectingId(null);
    void queryClient.invalidateQueries({ queryKey: ["counter-invoices", patientId] });
    void queryClient.invalidateQueries({ queryKey: ["counter-advances", patientId] });
    void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
    void invoiceId;
  };

  return (
    <Stack>
      <PageHeader
        title="Cashier counter"
        subtitle="Search a patient, collect against open invoices."
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
        actions={
          <Group gap="xs">
            <Button
              variant="subtle"
              leftSection={<IconListCheck size={16} />}
              onClick={() => navigate("/billing/worklist")}
            >
              Worklist
            </Button>
            <Button variant="subtle" onClick={() => navigate("/billing")}>
              Back office
            </Button>
          </Group>
        }
      />

      <Card withBorder>
        <Group align="flex-end" gap="sm">
          <PatientSearchSelect
            value={patientId}
            onChange={(id) => {
              setPatientId(id);
              setCollectingId(null);
            }}
            label="Patient"
            placeholder="Search by name, UHID, or phone…"
            size="md"
          />
          <TextInput
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
                <Title order={6}>Open invoices</Title>
                {canCreate && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => navigate(`/billing?patient_id=${patientId}`)}
                  >
                    New invoice
                  </Button>
                )}
              </Group>

              {invoicesQuery.isLoading && <Text c="dimmed">Loading…</Text>}
              {!invoicesQuery.isLoading && openInvoices.length === 0 && (
                <Alert variant="light" color="primary">
                  No open invoices for this patient. Use “New invoice” to start one, or check Back
                  office for drafts and history.
                </Alert>
              )}

              {openInvoices.map((invoice) => (
                <Card key={invoice.id} withBorder padding="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Text fw={700}>{invoice.invoice_number}</Text>
                        <Badge size="xs" variant="light" color="warning">
                          {invoice.status}
                        </Badge>
                        {invoice.is_er_deferred && (
                          <Badge size="xs" variant="light" color="danger">
                            ER deferred
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed">
                        Total ₹{money(invoice.total_amount)} · Paid ₹{money(invoice.paid_amount)} ·
                        Balance ₹{money(invoiceBalance(invoice))}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => navigate(billingInvoicePaymentRoute(invoice.id))}
                      >
                        Open
                      </Button>
                      <Button
                        size="xs"
                        leftSection={<IconCash size={14} />}
                        onClick={() =>
                          setCollectingId(collectingId === invoice.id ? null : invoice.id)
                        }
                      >
                        {collectingId === invoice.id ? "Close" : "Collect"}
                      </Button>
                    </Group>
                  </Group>
                  {collectingId === invoice.id && (
                    <Stack mt="sm">
                      <CollectPanel
                        invoice={invoice}
                        onCollected={() => onCollected(invoice.id)}
                        counterId={counterId}
                      />
                    </Stack>
                  )}
                </Card>
              ))}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}
