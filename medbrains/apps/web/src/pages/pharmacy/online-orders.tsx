import { Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type StorefrontQueueRow } from "@medbrains/types";
import { IconShoppingCart } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { storefrontService } from "@/services/storefront.service";
import { ORDER_STATUS_VIEW } from "../store/storefront";
import { OnlineOrderReview } from "./online-order-review";
import { OnlineRefunds } from "./online-refunds";
import { OnlineReturns } from "./online-returns";
import { OnlineStores } from "./online-stores";
import { StorefrontRulesForm } from "./storefront-rules";
import { StorefrontSettings } from "./storefront-settings";

const FILTERS = [
  { value: "awaiting_verification", label: "To verify" },
  { value: "released", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

/**
 * Online orders with prescription lines, for a registered pharmacist to
 * verify line by line; and, for whoever runs it, the storefront's settings.
 */
export function OnlineOrdersPage() {
  useRequirePermission(P.PHARMACY.STOREFRONT.VERIFY);
  const canVerify = useHasPermission(P.PHARMACY.STOREFRONT.VERIFY);
  const canReturns = useHasPermission(P.PHARMACY.STOREFRONT.RETURNS);
  const canManage = useHasPermission(P.PHARMACY.STOREFRONT.MANAGE);
  const [filter, setFilter] = useState("awaiting_verification");
  const [open, setOpen] = useState<StorefrontQueueRow | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["storefront-orders", filter],
    queryFn: () => storefrontService.listStorefrontOrders(filter),
    refetchInterval: 30_000,
    enabled: canVerify,
  });
  const patients = useMemo(
    () => new Map((data?.patients ?? []).map((p) => [p.id, p])),
    [data?.patients],
  );
  const columns = [
    {
      key: "patient",
      label: "Patient",
      render: (r: StorefrontQueueRow) => {
        const p = patients.get(r.patient_id);
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
      key: "prescription",
      label: "Prescription",
      render: (r: StorefrontQueueRow) => (
        <Stack gap={2}>
          <Text size="sm">{r.rx_source === "upload" ? "Uploaded" : "From this hospital"}</Text>
          {r.prescription_reused && (
            <Badge size="xs" tone="warning">
              Used by another patient
            </Badge>
          )}
        </Stack>
      ),
    },
    {
      key: "lines",
      label: "Medicines",
      render: (r: StorefrontQueueRow) => (
        <Text size="sm">{r.lines.map((l) => `${l.drug_name} × ${l.quantity}`).join(", ")}</Text>
      ),
    },
    {
      key: "flags",
      label: "Look at",
      render: (r: StorefrontQueueRow) => (
        <Stack gap={2}>
          {r.flags.map((f) => (
            <Badge key={f} size="xs" tone="warning">
              {f === "out_of_stock" ? "Out of stock" : f === "repeat_order" ? "Repeat order" : f}
            </Badge>
          ))}
        </Stack>
      ),
    },
    {
      key: "how",
      label: "Getting it",
      render: (r: StorefrontQueueRow) => (
        <Text size="sm">{r.fulfilment === "delivery" ? "Home delivery" : "Pickup"}</Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: StorefrontQueueRow) => (
        <Badge size="sm" tone={ORDER_STATUS_VIEW[r.status].tone}>
          {ORDER_STATUS_VIEW[r.status].label}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: StorefrontQueueRow) =>
        r.status === "awaiting_verification" ? (
          <Button size="xs" tone="primary" onClick={() => setOpen(r)}>
            Verify
          </Button>
        ) : null,
    },
  ];
  return (
    <Stack>
      <PageHeader
        title="Online orders"
        subtitle="Prescriptions to verify before an online order goes to fulfilment"
        icon={<IconShoppingCart size={20} stroke={1.5} />}
      />
      <Tabs defaultValue="orders">
        <Tabs.List>
          <Tabs.Tab value="orders">Orders</Tabs.Tab>
          {canReturns && <Tabs.Tab value="returns">Returns</Tabs.Tab>}
          {canReturns && <Tabs.Tab value="refunds">Refunds</Tabs.Tab>}
          {canManage && <Tabs.Tab value="settings">Settings</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="orders" pt="md">
          <Stack>
            <SegmentedControl value={filter} onChange={setFilter} data={FILTERS} />
            {isError ? (
              <Alert tone="danger" title="Online orders could not be loaded">
                This is not an empty list. Try again in a moment.
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                data={data?.orders ?? []}
                loading={isLoading}
                rowKey={(r) => r.id}
                emptyTitle="Nothing waiting"
              />
            )}
          </Stack>
        </Tabs.Panel>
        {canReturns && (
          <Tabs.Panel value="returns" pt="md">
            <OnlineReturns />
          </Tabs.Panel>
        )}
        {canReturns && (
          <Tabs.Panel value="refunds" pt="md">
            <OnlineRefunds />
          </Tabs.Panel>
        )}
        {canManage && (
          <Tabs.Panel value="settings" pt="md">
            <Stack>
              <StorefrontSettings />
              <StorefrontRulesForm />
              <OnlineStores />
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>
      <OnlineOrderReview
        row={open}
        patientName={open ? (patients.get(open.patient_id)?.full_name ?? "Patient") : ""}
        onClose={() => setOpen(null)}
      />
    </Stack>
  );
}
