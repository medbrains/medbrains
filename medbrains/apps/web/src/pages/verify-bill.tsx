/**
 * The page the QR on a printed bill opens. An insurer, an employer or the
 * patient checks that the hospital really issued this bill and that its
 * total matches the paper. No patient detail is shown: the holder already
 * has the paper. A wrong code and an unknown bill give the same answer.
 */
import { Group, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Alert, Badge, Card } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid in full",
  partially_paid: "Partly paid",
  issued: "Issued, not yet paid",
  draft: "Draft",
  cancelled: "Cancelled",
};

export function VerifyBillPage() {
  const [params] = useSearchParams();
  const number = params.get("n") ?? "";
  const code = params.get("c") ?? "";
  const {
    data: bill,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["verify-bill", number, code],
    queryFn: () => billingService.verifyBill(number, code),
    enabled: Boolean(number && code),
    retry: false,
  });

  if (isLoading) {
    return (
      <Stack p="xl" align="center">
        <Text>Checking this bill…</Text>
      </Stack>
    );
  }
  if (isError || !bill) {
    return (
      <Stack p="xl" gap="md" maw={640} mx="auto">
        <Title order={2}>This bill could not be verified</Title>
        <Alert tone="danger" title="No match">
          The code on this bill is not one a hospital on MedBrains issued, or the bill has been
          withdrawn. Contact the hospital before relying on it.
        </Alert>
      </Stack>
    );
  }
  return (
    <Stack p="xl" gap="md" maw={640} mx="auto">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={2}>Issued by {bill.hospital_name}</Title>
          <Text size="sm" c="dimmed">
            Bill {bill.invoice_number} · {new Date(bill.invoice_date).toLocaleDateString()}
          </Text>
        </Stack>
        <Badge tone="success">Genuine</Badge>
      </Group>
      <Card withBorder padding="md">
        <Group justify="space-between">
          <Text>Total</Text>
          <Text fw={700}>₹{bill.total_amount}</Text>
        </Group>
        <Group justify="space-between">
          <Text>Paid</Text>
          <Text>₹{bill.paid_amount}</Text>
        </Group>
        <Text size="sm" c="dimmed" mt="xs">
          {STATUS_LABEL[bill.status] ?? bill.status}. Check these match the paper in front of you.
        </Text>
      </Card>
    </Stack>
  );
}
