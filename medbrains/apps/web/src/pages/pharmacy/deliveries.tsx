import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DeliveryStatus, P, type PharmacyDelivery } from "@medbrains/types";
import { IconTruckDelivery } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, type BadgeTone, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { deliveryService } from "@/services/delivery.service";
import { DeliveryActions } from "./delivery-actions";
import { DeliverySettings } from "./delivery-settings";

const STATUS: Record<DeliveryStatus, { label: string; tone: BadgeTone }> = {
  arranged: { label: "To dispatch", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Not delivered", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const FILTERS = [
  { value: "out_for_delivery", label: "Out" },
  { value: "arranged", label: "To dispatch" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Not delivered" },
  { value: "all", label: "All" },
];

/**
 * Home deliveries: what is waiting to go, what is on the road, and how each
 * ended. The pharmacy sees every delivery; a runner sees their own.
 */
export function DeliveriesPage() {
  useRequirePermission(P.PHARMACY.DELIVERIES.VIEW);
  const canArrange = useHasPermission(P.PHARMACY.DELIVERIES.ARRANGE);
  const [filter, setFilter] = useState("out_for_delivery");
  const status = filter === "all" ? undefined : filter;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pharmacy-deliveries", status],
    queryFn: () => deliveryService.listDeliveries(status),
    refetchInterval: 30_000,
  });
  const { data: runners = [] } = useQuery({
    queryKey: ["delivery-runners"],
    queryFn: () => deliveryService.listDeliveryRunners(),
    enabled: canArrange,
    staleTime: 300_000,
  });
  const patients = useMemo(
    () => new Map((data?.patients ?? []).map((p) => [p.id, p])),
    [data?.patients],
  );
  const runnerNames = useMemo(() => new Map(runners.map((r) => [r.id, r.full_name])), [runners]);

  const columns = [
    {
      key: "patient",
      label: "Patient",
      render: (d: PharmacyDelivery) => {
        const p = patients.get(d.patient_id);
        return (
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              {p?.full_name ?? "Patient"}
            </Text>
            <Text size="xs" c="dimmed">
              {p?.uhid}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "address",
      label: "Deliver to",
      render: (d: PharmacyDelivery) => (
        <Stack gap={0}>
          <Text size="sm">{d.address}</Text>
          <Text size="xs" c="dimmed">
            {[d.landmark, d.pincode, d.contact_phone].filter(Boolean).join(" · ")}
          </Text>
          {d.refill_request_id && (
            <Text size="xs" c="dimmed">
              Asked for by the patient{d.preferred_slot ? ` · ${d.preferred_slot}` : ""}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "how",
      label: "By",
      render: (d: PharmacyDelivery) => (
        <Text size="sm">
          {d.mode === "courier"
            ? `${d.courier_name}${d.tracking_ref ? ` · ${d.tracking_ref}` : ""}`
            : d.runner_id
              ? (runnerNames.get(d.runner_id) ?? "Runner")
              : "Not given to anyone yet"}
        </Text>
      ),
    },
    {
      key: "payment",
      label: "Payment",
      render: (d: PharmacyDelivery) => (
        <Text size="sm">
          {d.payment === "cash_on_delivery" ? `Cash on delivery · ₹${d.amount_due}` : "Paid"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (d: PharmacyDelivery) => (
        <Stack gap={2}>
          <Badge tone={STATUS[d.status].tone} size="sm">
            {STATUS[d.status].label}
          </Badge>
          {d.failure_reason && (
            <Text size="xs" c="dimmed">
              {d.failure_reason}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (d: PharmacyDelivery) => <DeliveryActions delivery={d} runners={runners} />,
    },
  ];

  return (
    <Stack>
      <PageHeader
        title="Home deliveries"
        subtitle="Medicines on their way to patients"
        icon={<IconTruckDelivery size={20} stroke={1.5} />}
      />
      <DeliverySettings />
      <SegmentedControl value={filter} onChange={setFilter} data={FILTERS} />
      {isError ? (
        <Alert tone="danger" title="Deliveries could not be loaded">
          This is not an empty list. Try again in a moment.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={data?.deliveries ?? []}
          loading={isLoading}
          rowKey={(d) => d.id}
          emptyTitle="No deliveries here"
        />
      )}
    </Stack>
  );
}
