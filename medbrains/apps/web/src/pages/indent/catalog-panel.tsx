// INDENT CatalogPanel — split from indent.tsx (pure move).

import { Drawer, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  CreateStoreCatalogRequest,
  StoreCatalog,
  UpdateStoreCatalogRequest,
} from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { indentService } from "@/services/indent.service";

function CatalogForm({ initial, onSuccess }: { initial?: StoreCatalog; onSuccess: () => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "unit");
  const [basePrice, setBasePrice] = useState(Number(initial?.base_price ?? 0));
  const [reorderLevel, setReorderLevel] = useState(initial?.reorder_level ?? 0);

  const createMutation = useMutation({
    mutationFn: () =>
      indentService.createStoreCatalogItem({
        code,
        name,
        category: category || undefined,
        unit: unit || undefined,
        base_price: basePrice,
        reorder_level: reorderLevel,
      } as CreateStoreCatalogRequest),
    onSuccess: () => {
      toast.success("Catalog item created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!initial) throw new Error("No catalog item selected");
      return indentService.updateStoreCatalogItem(initial.id, {
        name,
        category: category || undefined,
        unit: unit || undefined,
        base_price: basePrice,
        reorder_level: reorderLevel,
      } as UpdateStoreCatalogRequest);
    },
    onSuccess: () => {
      toast.success("Catalog item updated", { title: "Updated" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <TextInput
        label="Code"
        value={code}
        onChange={(e) => setCode(e.currentTarget.value)}
        required
        disabled={!!initial}
      />
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        required
      />
      <TextInput
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.currentTarget.value)}
      />
      <TextInput label="Unit" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
      <NumberInput
        label="Base Price"
        value={basePrice}
        onChange={(v) => setBasePrice(Number(v))}
        decimalScale={2}
        min={0}
      />
      <NumberInput
        label="Reorder Level"
        value={reorderLevel}
        onChange={(v) => setReorderLevel(Number(v))}
        min={0}
      />
      <Button
        tone="primary"
        loading={initial ? updateMutation.isPending : createMutation.isPending}
        onClick={() => (initial ? updateMutation.mutate() : createMutation.mutate())}
      >
        {initial ? "Update" : "Create"}
      </Button>
    </Stack>
  );
}

export function CatalogPanel() {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<StoreCatalog | null>(null);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: StoreCatalog) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: StoreCatalog) => row.name },
    { key: "category", label: "Category", render: (row: StoreCatalog) => row.category ?? "-" },
    { key: "unit", label: "Unit", render: (row: StoreCatalog) => row.unit },
    { key: "base_price", label: "Price", render: (row: StoreCatalog) => `₹${row.base_price}` },
    {
      key: "current_stock",
      label: "Stock",
      render: (row: StoreCatalog) => (
        <Badge tone={row.current_stock <= row.reorder_level ? "danger" : "success"}>
          {row.current_stock}
        </Badge>
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      render: (row: StoreCatalog) => row.reorder_level,
    },
    {
      key: "actions",
      label: "",
      render: (row: StoreCatalog) => (
        <IconButton
          onClick={() => {
            setEditItem(row);
            openEdit();
          }}
          aria-label="View details"
        >
          <IconEye size={16} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add Item
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={catalog ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No catalog items"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Add Catalog Item"
        position="right"
        size="xl"
      >
        <CatalogForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={editOpened}
        onClose={closeEdit}
        title="Edit Catalog Item"
        position="right"
        size="xl"
      >
        {editItem && (
          <CatalogForm
            initial={editItem}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
              closeEdit();
            }}
          />
        )}
      </Drawer>
    </>
  );
}
