import { Group, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { usablePrescriptions } from "./storefront";

interface StoreRxProps {
  token: string;
  /** The cart now holds this prescription's medicines. */
  onOrdered: (prescriptionId: string) => void;
}

/**
 * "Order my prescription": a prescription written here fills the cart in one
 * tap — no upload. A pharmacist still checks each medicine.
 */
export function StoreRx({ token, onOrdered }: StoreRxProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const refills = useQuery({
    queryKey: ["portal-refills"],
    queryFn: () => portalService.getPortalRefills(token),
  });
  const order = useMutation({
    mutationFn: (id: string) => portalService.orderPortalPrescription(token, id),
    onSuccess: (filled) => {
      queryClient.setQueryData(["store-cart"], filled.cart);
      if (filled.left_out.length > 0) {
        toast.info(filled.left_out.map((l) => `${l.drug_name}: ${l.reason}`).join(" · "), {
          title: "Some medicines aren't in your cart",
        });
      }
      onOrdered(filled.prescription_id);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Couldn't order it" }),
  });
  if (refills.isError) {
    return (
      <Alert tone="warning" title="Couldn't load your prescriptions">
        Try again in a moment.
      </Alert>
    );
  }
  const usable = usablePrescriptions(refills.data ?? [], today);
  if (refills.data && usable.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No current prescriptions from this hospital.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {usable.map((r) => (
        <Card key={r.prescription_id} padding="sm">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={0}>
              <Text size="sm" fw={600}>
                {r.drugs.join(", ")}
              </Text>
              <Text size="xs" c="dimmed">
                {r.doctor_name ? `${r.doctor_name} · ` : ""}
                {r.prescribed_at.slice(0, 10)}
                {r.valid_until ? ` · valid until ${r.valid_until}` : ""}
              </Text>
            </Stack>
            <Button
              tone="primary"
              loading={order.isPending && order.variables === r.prescription_id}
              onClick={() => order.mutate(r.prescription_id)}
            >
              Order these medicines
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
