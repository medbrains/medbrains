import { Group, Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconPill, IconPlus } from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { PharmacyOrderDetail } from "./pharmacy/order-detail";
import { PharmacyOrderForm } from "./pharmacy/order-form";
import { PharmacyPageInner } from "./pharmacy/page-inner";

// Dropdown options for categorical fields - aligned with ATC classification
const PHARMACY_PAGE_PERMISSIONS = [
  P.PHARMACY.PRESCRIPTIONS_LIST,
  P.PHARMACY.PRESCRIPTIONS_VIEW,
  P.PHARMACY.DISPENSING_CREATE,
  P.PHARMACY.DISPENSING_PARTIAL,
  P.PHARMACY.DISPENSING_CANCEL,
  P.PHARMACY.DISPENSING_VOID,
  P.PHARMACY.RX_QUEUE_LIST,
  P.PHARMACY.RX_QUEUE_REVIEW,
  P.PHARMACY.POS_VIEW,
  P.PHARMACY.POS_CREATE,
  P.PHARMACY.POS_CANCEL,
  P.PHARMACY.POS_RETURN,
  P.PHARMACY.STOCK_MANAGE,
  P.PHARMACY.NDPS_LIST,
  P.PHARMACY.NDPS_MANAGE,
  P.PHARMACY.STORES_LIST,
  P.PHARMACY.STORES_MANAGE,
  P.PHARMACY.ANALYTICS_VIEW,
  P.PHARMACY.RETURNS_LIST,
  P.PHARMACY.RETURNS_REQUEST,
  P.PHARMACY.RETURNS_APPROVE,
  P.PHARMACY.RETURNS_RESTOCK,
  P.PHARMACY.RETURNS_DESTROY,
  P.PHARMACY.RETURNS_REJECT,
  P.PHARMACY.SAFETY_VIEW,
] as const;

export function PharmacyPage() {
  useRequirePermission(PHARMACY_PAGE_PERMISSIONS);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-orders">
      <PharmacyPageInner />
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderCreatePage() {
  useRequirePermission(P.PHARMACY.DISPENSING_CREATE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  function ordersPath() {
    const params = new URLSearchParams({ tab: "orders" });
    if (initialPatientId) {
      params.set("patient_id", initialPatientId);
    }
    return `/pharmacy?${params.toString()}`;
  }

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-create">
      <Stack>
        <PageHeader
          title="New Pharmacy Order"
          subtitle="Create a patient-linked medicine order with safety and billing synchronization."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(ordersPath())}
            >
              Orders
            </Button>
          }
        />
        <PharmacyOrderForm
          initialPatientId={initialPatientId}
          canViewPatientRecord={canViewPatientRecord}
          onCancel={() => navigate(ordersPath())}
          onSuccess={(detail) => navigate(`/pharmacy/orders/${detail.order.id}`)}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderDetailPage() {
  useRequirePermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const navigate = useNavigate();
  const { orderId } = useParams();
  const canAdjustPartialDispense = useHasPermission(P.PHARMACY.DISPENSING_PARTIAL);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-detail">
      <Stack>
        <PageHeader
          title="Pharmacy Order"
          subtitle="Dispensing detail, FEFO hints, labels, and synchronized billing lines."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Group gap="xs">
              <Button
                tone="secondary"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/pharmacy?tab=orders")}
              >
                Orders
              </Button>
              {canDispense && (
                <Button
                  tone="primary"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => navigate("/pharmacy/orders/new")}
                >
                  New Order
                </Button>
              )}
            </Group>
          }
        />
        {orderId ? (
          <PharmacyOrderDetail
            orderId={orderId}
            canEditItems={canAdjustPartialDispense}
            canDispense={canDispense}
            canViewReturns={canViewReturns}
            canViewPatientRecord={canViewPatientRecord}
          />
        ) : (
          <Alert tone="warning">Pharmacy order id is missing from the route.</Alert>
        )}
      </Stack>
    </ClinicalEventProvider>
  );
}
