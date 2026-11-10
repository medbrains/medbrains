import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type OnlineStore, P, type StorefrontFloorRow } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Button, Card, Input, NumberField, Switch, TextArea, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";
import { parsePincodes } from "../store/storefront-p2";

/**
 * Which pharmacy locations fill online orders and where each delivers; with
 * none switched on the hospital sells as one pharmacy. And each item's
 * online floor: the units the wards and the counter keep.
 */
export function OnlineStores() {
  const canManage = useHasPermission(P.PHARMACY.STOREFRONT.MANAGE);
  const stores = useQuery({
    queryKey: ["storefront-stores"],
    queryFn: () => storefrontService.listOnlineStores(),
    enabled: canManage,
  });
  if (!canManage) return null;
  if (stores.isError) {
    return (
      <Alert tone="danger" title="Locations could not be loaded">
        Try again in a moment.
      </Alert>
    );
  }
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Switch on the pharmacies that fill online orders. A patient outside every store's pincodes
        is told it isn't delivered there and offered pickup.
      </Text>
      {(stores.data ?? []).map((s) => (
        <StoreCard key={s.store_location_id} store={s} />
      ))}
      <OnlineFloors />
    </Stack>
  );
}

function StoreCard({ store }: { store: OnlineStore }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(store.enabled);
  const [pincode, setPincode] = useState(store.pincode ?? "");
  const [serves, setServes] = useState(store.serviceable_pincodes.join(", "));
  const save = useMutation({
    mutationFn: () => {
      const { pincodes, bad } = parsePincodes(serves);
      if (bad.length > 0) throw new Error(`Not pincodes: ${bad.join(", ")}`);
      return storefrontService.updateOnlineStore(store.store_location_id, {
        enabled,
        pincode: pincode.trim() || null,
        serviceable_pincodes: pincodes,
      });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["storefront-stores"], next);
      toast.success(`${store.name} saved`);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  return (
    <Card padding="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            {store.name} · {store.code}
            {store.is_pharmacy ? "" : " (not set up as a pharmacy)"}
          </Text>
          <Switch
            label="Fills online orders"
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
          />
        </Group>
        <Group grow>
          <Input
            label="Its pincode"
            value={pincode}
            onChange={(e) => setPincode(e.currentTarget.value)}
          />
        </Group>
        <TextArea
          label="Delivers to these pincodes"
          description="Comma or space separated; empty means pickup only"
          value={serves}
          onChange={(e) => setServes(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button size="xs" tone="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function OnlineFloors() {
  const queryClient = useQueryClient();
  const floors = useQuery({
    queryKey: ["storefront-floors"],
    queryFn: () => storefrontService.listStorefrontFloors(),
  });
  const set = useMutation({
    mutationFn: ({ id, floor }: { id: string; floor: number | null }) =>
      storefrontService.setStorefrontListing(
        id,
        floor === null ? { floor_from_reorder_level: true } : { online_reserve_floor: floor },
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["storefront-floors"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Floor not saved" }),
  });
  if (floors.isError) {
    return (
      <Alert tone="danger" title="Online floors could not be loaded">
        Try again in a moment.
      </Alert>
    );
  }
  const columns = [
    {
      key: "name",
      label: "Item",
      render: (r: StorefrontFloorRow) => <Text size="sm">{r.name}</Text>,
    },
    {
      key: "stock",
      label: "On hand · held online",
      render: (r: StorefrontFloorRow) => (
        <Text size="sm">
          {r.on_hand} · {r.held}
        </Text>
      ),
    },
    {
      key: "floor",
      label: "Kept for wards and counter",
      render: (r: StorefrontFloorRow) => (
        <Group gap="xs" wrap="nowrap">
          <NumberField
            aria-label={`Online floor for ${r.name}`}
            w={110}
            min={0}
            value={r.online_reserve_floor ?? r.reorder_level}
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v) && v !== (r.online_reserve_floor ?? r.reorder_level)) {
                set.mutate({ id: r.id, floor: Math.max(0, Math.round(v)) });
              }
            }}
          />
          {r.online_reserve_floor !== null && (
            <Button size="xs" tone="tertiary" onClick={() => set.mutate({ id: r.id, floor: null })}>
              Use reorder level ({r.reorder_level})
            </Button>
          )}
        </Group>
      ),
    },
  ];
  return (
    <Stack gap="xs">
      <Text fw={600}>Online floor per item</Text>
      <DataTable
        columns={columns}
        data={floors.data ?? []}
        loading={floors.isLoading}
        rowKey={(r) => r.id}
        emptyTitle="Nothing is sold online yet"
      />
    </Stack>
  );
}
