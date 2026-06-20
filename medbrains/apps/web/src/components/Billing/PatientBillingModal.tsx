import { Group, Stack, Text } from "@mantine/core";
import type { useDisclosure } from "@mantine/hooks";
import type { Invoice } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge, type BadgeTone, Button, Card, Modal } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  issued: "info",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
};

interface PatientBillingModalProps {
  patientId: string;
  encounterId?: string | null;
  control: ReturnType<typeof useDisclosure>;
}

/** Billing quick-actions for a patient — invoice list + create a draft, opened
 *  from the Patient Flow "Billing" chip instead of navigating to the page. */
export function PatientBillingModal({ patientId, encounterId, control }: PatientBillingModalProps) {
  const [opened, { close }] = control;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["patient-invoices", patientId],
    queryFn: () => billingService.listInvoices({ patient_id: patientId }),
    enabled: opened,
  });

  const create = useMutation({
    mutationFn: () =>
      billingService.createInvoice({
        patient_id: patientId,
        encounter_id: encounterId ?? undefined,
      }),
    onSuccess: (invoice: Invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
      close();
      navigate(`/billing?tab=invoices&invoice_id=${invoice.id}`);
    },
  });

  const invoices = data?.invoices ?? [];

  return (
    <Modal opened={opened} onClose={close} title="Billing" size="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} for this patient
          </Text>
          <Button
            tone="primary"
            size="xs"
            leftSection={<Plus size={14} />}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            New draft invoice
          </Button>
        </Group>

        {isLoading ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : invoices.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No invoices yet.
          </Text>
        ) : (
          invoices.map((invoice) => (
            <Card
              key={invoice.id}
              withBorder
              padding="sm"
              style={{ cursor: "pointer" }}
              onClick={() => {
                close();
                navigate(`/billing?tab=invoices&invoice_id=${invoice.id}`);
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={600} ff="var(--mb-font-mono)">
                    {invoice.invoice_number}
                  </Text>
                  <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>
                    {invoice.status.replace(/_/g, " ")}
                  </Badge>
                </Group>
                <Group gap="md" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    Paid {invoice.paid_amount}
                  </Text>
                  <Text size="sm" fw={600}>
                    {invoice.total_amount}
                  </Text>
                </Group>
              </Group>
            </Card>
          ))
        )}

        <Button tone="secondary" size="xs" onClick={() => navigate("/billing")}>
          Open billing
        </Button>
      </Stack>
    </Modal>
  );
}
