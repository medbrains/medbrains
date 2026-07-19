// INDENT StockPanel — split from indent.tsx (pure move).

import { Drawer, Group, NumberInput, Select, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { StoreStockMovement } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { indentService } from "@/services/indent.service";

function StockMovementForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [movementType, setMovementType] = useState("receipt");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      indentService.createStoreStockMovement({
        catalog_item_id: catalogItemId,
        movement_type: movementType as "receipt" | "issue" | "return" | "adjustment" | "transfer",
        quantity,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Stock movement recorded", { title: "Recorded" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({
          value: c.id,
          label: `${c.code} - ${c.name} (Stock: ${c.current_stock})`,
        }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <Select
        label="Movement Type"
        data={[
          { value: "receipt", label: "Receipt (In)" },
          { value: "issue", label: "Issue (Out)" },
          { value: "return", label: "Return (In)" },
          { value: "adjustment", label: "Adjustment" },
          { value: "transfer", label: "Transfer (Out)" },
        ]}
        value={movementType}
        onChange={(v) => setMovementType(v ?? "receipt")}
      />
      <NumberInput
        label="Quantity"
        value={quantity}
        onChange={(v) => setQuantity(Number(v))}
        min={1}
        required
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!catalogItemId}
      >
        Record Movement
      </Button>
    </Stack>
  );
}

export function StockPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-movements", page],
    queryFn: () => indentService.listStoreStockMovements({ page: String(page), per_page: "50" }),
  });

  const columns = [
    {
      key: "movement_type",
      label: "Type",
      render: (row: StoreStockMovement) => (
        <Badge
          tone={
            row.movement_type === "receipt" || row.movement_type === "return" ? "success" : "danger"
          }
          size="sm"
        >
          {row.movement_type}
        </Badge>
      ),
    },
    { key: "quantity", label: "Qty", render: (row: StoreStockMovement) => row.quantity },
    {
      key: "reference_type",
      label: "Reference",
      render: (row: StoreStockMovement) => row.reference_type ?? "-",
    },
    { key: "notes", label: "Notes", render: (row: StoreStockMovement) => row.notes ?? "-" },
    {
      key: "created_at",
      label: "Date",
      render: (row: StoreStockMovement) => new Date(row.created_at).toLocaleString(),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Record Movement
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={data?.movements ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 50)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No stock movements"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Record Stock Movement"
        position="right"
        size="xl"
      >
        <StockMovementForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
            void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}
