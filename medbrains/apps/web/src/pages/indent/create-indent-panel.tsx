// INDENT CreateIndentPanel — split from indent.tsx (pure move).

import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import type { CreateIndentItemInput, IndentPriority, IndentType } from "@medbrains/types";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, IconButton, Table, toast } from "@/components/ui";
import { DEPARTMENT_LIST_CODES } from "@/lib/api-permission-sets";
import { indentService } from "@/services/indent.service";
import { indentTypeLabels } from "./shared";

type CreateIndentFormItem = CreateIndentItemInput & { row_key: string };

function createIndentFormItem(): CreateIndentFormItem {
  return {
    row_key: crypto.randomUUID(),
    item_name: "",
    quantity_requested: 1,
  };
}

function toIndentType(value: string): IndentType {
  if (
    value === "general" ||
    value === "pharmacy" ||
    value === "lab" ||
    value === "surgical" ||
    value === "housekeeping" ||
    value === "emergency"
  ) {
    return value;
  }
  return "general";
}

function toIndentPriority(value: string): IndentPriority {
  if (value === "normal" || value === "urgent" || value === "emergency") {
    return value;
  }
  return "normal";
}

export function CreateIndentPanel({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [indentType, setIndentType] = useState<string>("general");
  const [priority, setPriority] = useState<string>("normal");
  const [departmentId, setDepartmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateIndentFormItem[]>([createIndentFormItem()]);

  // The department filter is served by the shared setup endpoint, which the
  // indent codes are not on. Refused, the picker renders empty and reads as a
  // hospital with no departments to requisition for.
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => indentService.listDepartments(),
    enabled: canListDepartments,
  });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      indentService.createIndentRequisition({
        department_id: departmentId,
        indent_type: toIndentType(indentType),
        priority: toIndentPriority(priority),
        notes: notes || undefined,
        items: items.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          item_name: item.item_name,
          quantity_requested: item.quantity_requested,
          unit_price: item.unit_price,
          item_context: item.item_context,
          notes: item.notes,
        })),
      }),
    onSuccess: () => {
      toast.success("Indent requisition created", { title: "Created" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      onDone();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const addItem = () => setItems([...items, createIndentFormItem()]);

  const removeItem = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const updateItem = (idx: number, field: keyof CreateIndentItemInput, value: unknown) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  return (
    <Stack mt="md">
      <Text fw={600} size="lg">
        Create New Indent
      </Text>

      <Group grow>
        <Select
          label="Department"
          placeholder="Select department"
          data={departmentOptions}
          value={departmentId}
          onChange={(v) => setDepartmentId(v ?? "")}
          searchable
          required
        />
        <Select
          label="Indent Type"
          data={Object.entries(indentTypeLabels).map(([value, label]) => ({ value, label }))}
          value={indentType}
          onChange={(v) => setIndentType(v ?? "general")}
        />
        <Select
          label="Priority"
          data={[
            { value: "normal", label: "Normal" },
            { value: "urgent", label: "Urgent" },
            { value: "emergency", label: "Emergency" },
          ]}
          value={priority}
          onChange={(v) => setPriority(v ?? "normal")}
        />
      </Group>

      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item Name</Table.Th>
            <Table.Th>Catalog Item</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Unit Price</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, idx) => (
            <Table.Tr key={item.row_key}>
              <Table.Td>
                <TextInput
                  size="xs"
                  placeholder="Item name"
                  value={item.item_name}
                  onChange={(e) => updateItem(idx, "item_name", e.currentTarget.value)}
                  required
                />
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  placeholder="From catalog"
                  data={(catalog ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.code} - ${c.name}`,
                  }))}
                  value={item.catalog_item_id ?? null}
                  onChange={(v) => {
                    const cat = catalog?.find((c) => c.id === v);
                    if (cat) {
                      updateItem(idx, "catalog_item_id", v);
                      updateItem(idx, "item_name", cat.name);
                      updateItem(idx, "unit_price", Number(cat.base_price));
                    }
                  }}
                  searchable
                  clearable
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  size="xs"
                  w={80}
                  min={1}
                  value={item.quantity_requested}
                  onChange={(v) => updateItem(idx, "quantity_requested", Number(v))}
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  size="xs"
                  w={100}
                  min={0}
                  decimalScale={2}
                  value={item.unit_price ?? 0}
                  onChange={(v) => updateItem(idx, "unit_price", Number(v))}
                />
              </Table.Td>
              <Table.Td>
                <IconButton tone="danger" onClick={() => removeItem(idx)} aria-label="Close">
                  <IconX size={14} />
                </IconButton>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={addItem}
        w="fit-content"
      >
        Add Item
      </Button>

      <Group>
        <Button
          tone="primary"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          disabled={!departmentId || items.every((i) => !i.item_name)}
        >
          Create Indent
        </Button>
        <Button tone="secondary" onClick={onDone}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Store Catalog Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Stock Movements Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Analytics Panel
// ══════════════════════════════════════════════════════════

// ── ABC Analysis ─────────────────────────────────────────

// ── VED Analysis ─────────────────────────────────────────

// ── FSN Analysis ─────────────────────────────────────────

// ── Dead Stock Report ────────────────────────────────────

// ── Purchase vs Consumption ──────────────────────────────

// ── Inventory Valuation ──────────────────────────────────

// ── Compliance Report ────────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Patient Consumables Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Assets & Implants Panel
// ══════════════════════════════════════════════════════════

// ── Condemnations ────────────────────────────────────────
