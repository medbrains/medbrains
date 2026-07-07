import { Group, NumberInput, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { WardStockRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Badge, Button, Drawer, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { pharmacyService } from "@/services/pharmacy.service";

export function WardStockPage() {
  useRequirePermission(P.PHARMACY.STORES_MANAGE);
  const canManage = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const qc = useQueryClient();
  const [dept, setDept] = useState("");
  const [parOpen, parHandlers] = useDisclosure(false);
  const [consumeOpen, consumeHandlers] = useDisclosure(false);
  const [drugId, setDrugId] = useState("");
  const [parQty, setParQty] = useState(0);
  const [consumeRow, setConsumeRow] = useState<WardStockRow | null>(null);
  const [consumeQty, setConsumeQty] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ward-stock", dept],
    queryFn: () => pharmacyService.listWardStock(dept),
    enabled: !!dept,
  });

  const replenish = useMutation({
    mutationFn: () => pharmacyService.replenishWard(dept),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["ward-stock", dept] });
      toast.success(`Replenished ${r.items_replenished} items (${r.total_issued} units)`, {
        title: "Ward stock",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Replenish failed" }),
  });

  const setPar = useMutation({
    mutationFn: () =>
      pharmacyService.setWardPar({
        department_id: dept,
        catalog_item_id: drugId,
        par_qty: parQty,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ward-stock", dept] });
      toast.success("Par level set", { title: "Ward stock" });
      parHandlers.close();
      setDrugId("");
      setParQty(0);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not set par" }),
  });

  const consume = useMutation({
    mutationFn: () =>
      pharmacyService.consumeWardStock({
        department_id: dept,
        catalog_item_id: consumeRow?.catalog_item_id ?? "",
        quantity: consumeQty,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ward-stock", dept] });
      toast.success("Consumption recorded", { title: "Ward stock" });
      consumeHandlers.close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Consume failed" }),
  });

  const columns: Column<WardStockRow>[] = [
    { key: "drug_name", label: "Drug", render: (r) => r.drug_name },
    { key: "par_qty", label: "Par", render: (r) => r.par_qty },
    {
      key: "on_hand",
      label: "On hand",
      render: (r) => (
        <Badge tone={r.on_hand <= r.min_qty ? "danger" : "neutral"}>{r.on_hand}</Badge>
      ),
    },
    { key: "gap", label: "To replenish", render: (r) => (r.gap > 0 ? r.gap : "—") },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage ? (
          <Button
            size="xs"
            tone="secondary"
            disabled={r.on_hand <= 0}
            onClick={() => {
              setConsumeRow(r);
              setConsumeQty(1);
              consumeHandlers.open();
            }}
          >
            Consume
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Ward stock"
        subtitle="Par / imprest stock per ward — replenish to par + consume"
      />
      <Group align="flex-end" gap="sm">
        <DepartmentSelect value={dept} onChange={setDept} label="Ward" />
        {dept && canManage && (
          <>
            <Button leftSection={<IconPlus size={16} />} onClick={parHandlers.open}>
              Set par
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconRefresh size={16} />}
              onClick={() => replenish.mutate()}
              loading={replenish.isPending}
            >
              Replenish to par
            </Button>
          </>
        )}
      </Group>

      {dept ? (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          rowKey={(r) => r.catalog_item_id}
          emptyTitle="No par levels set for this ward yet."
        />
      ) : (
        <Text c="dimmed">Select a ward to view its par stock.</Text>
      )}

      <Drawer opened={parOpen} onClose={parHandlers.close} title="Set par level">
        <Stack gap="sm">
          <DrugSearchSelect value={drugId} onChange={(id) => setDrugId(id)} />
          <NumberInput
            label="Par quantity"
            value={parQty}
            onChange={(v) => setParQty(typeof v === "number" ? v : 0)}
            min={0}
          />
          <Button
            onClick={() => setPar.mutate()}
            loading={setPar.isPending}
            disabled={!drugId || parQty <= 0}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer opened={consumeOpen} onClose={consumeHandlers.close} title="Consume ward stock">
        {consumeRow && (
          <Stack gap="sm">
            <Text size="sm">
              {consumeRow.drug_name} · on hand {consumeRow.on_hand}
            </Text>
            <NumberInput
              label="Quantity"
              value={consumeQty}
              onChange={(v) => setConsumeQty(typeof v === "number" ? v : 1)}
              min={1}
              max={consumeRow.on_hand}
            />
            <Button onClick={() => consume.mutate()} loading={consume.isPending}>
              Consume
            </Button>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
