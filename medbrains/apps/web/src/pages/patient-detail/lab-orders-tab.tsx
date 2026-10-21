// PATIENT LabOrdersTab — every lab order on the patient, each openable to its
// result values, including orders placed directly at the lab desk.

import { Loader, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { LabOrderHistoryTable } from "@/components/Lab/LabOrderHistoryTable";
import { Alert } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

export function LabOrdersTab({ patientId }: { patientId: string }) {
  const canList = useHasPermission(P.LAB.ORDERS_LIST);
  const {
    data: orders,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => patientDetailService.listPatientLabOrders(patientId),
    enabled: canList,
  });

  if (!canList) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        You do not have permission to see this patient's lab orders. This is not the same as having
        none.
      </Text>
    );
  }
  if (isLoading) return <Loader size="sm" />;
  if (isError) {
    return (
      <Alert tone="danger" title="Lab orders could not be loaded">
        This does not mean the patient has none. Try again in a moment.
      </Alert>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No lab orders found.
      </Text>
    );
  }

  return <LabOrderHistoryTable orders={orders} />;
}
