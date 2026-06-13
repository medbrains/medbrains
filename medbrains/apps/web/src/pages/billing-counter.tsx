import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { Invoice, PatientAdvance, PaymentMode } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCash, IconListCheck, IconReceipt, IconWallet } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader, PatientSearchSelect } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { billingInvoicePaymentRoute } from "./billing-workspace";

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
];

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

/** A counter-paced collect panel: amount, cash tendered, change due. */
function CollectPanel({ invoice, onCollected }: { invoice: Invoice; onCollected: () => void }) {
  const balance = invoiceBalance(invoice);
  const [amount, setAmount] = useState<number | string>(balance);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [tendered, setTendered] = useState<number | string>(balance);

  const payMutation = useMutation({
    mutationFn: () =>
      billingService.recordPayment(invoice.id, {
        amount: typeof amount === "number" ? amount : Number(amount) || 0,
        mode,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Payment recorded",
        message: `${invoice.invoice_number} — ₹${money(amount)} ${mode}`,
        color: "success",
      });
      onCollected();
    },
    onError: (error: Error) => {
      notifications.show({ title: "Payment failed", message: error.message, color: "danger" });
    },
  });

  const amountNum = typeof amount === "number" ? amount : Number(amount) || 0;
  const tenderedNum = typeof tendered === "number" ? tendered : Number(tendered) || 0;
  const changeDue = mode === "cash" ? Math.max(0, tenderedNum - amountNum) : 0;
  const shortfall = amountNum > balance;

  return (
    <Card withBorder bg="var(--fc-panel, #f7f8f6)">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Collect for {invoice.invoice_number}
          </Text>
          <Text size="sm" c="dimmed">
            Balance ₹{money(balance)}
          </Text>
        </Group>
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as PaymentMode)}
          data={PAYMENT_MODES}
        />
        <Group grow align="flex-start">
          <NumberInput
            label="Amount"
            value={amount}
            onChange={setAmount}
            min={0}
            max={balance}
            decimalScale={2}
            error={shortfall ? "Exceeds balance" : undefined}
          />
          {mode === "cash" && (
            <NumberInput
              label="Cash tendered"
              value={tendered}
              onChange={setTendered}
              min={0}
              decimalScale={2}
            />
          )}
        </Group>
        {mode === "cash" && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Change due
            </Text>
            <Text size="lg" fw={700} c={changeDue > 0 ? "copper" : undefined}>
              ₹{money(changeDue)}
            </Text>
          </Group>
        )}
        <Button
          leftSection={<IconCash size={16} />}
          loading={payMutation.isPending}
          disabled={amountNum <= 0 || shortfall}
          onClick={() => payMutation.mutate()}
        >
          Record ₹{money(amountNum)} payment
        </Button>
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
                      <CollectPanel invoice={invoice} onCollected={() => onCollected(invoice.id)} />
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
