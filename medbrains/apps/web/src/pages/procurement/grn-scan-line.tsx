// One line of a scanned bill under review: what was read, how sure the reader
// was, the checks it fails, and the catalogue item it maps to.

import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { GrnScanDraftFormInput } from "@medbrains/schemas";
import type { GrnItemSuggestion } from "@medbrains/types";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Control, Controller, type FieldErrors } from "react-hook-form";
import { Badge, Card, IconButton, Input, Select } from "@/components/ui";
import { grnScanService } from "@/services/grnScan.service";
import { confidenceLabel, type LineMessage, needsCheck } from "./grn-scan-logic";

type LineField =
  | "batch_number"
  | "expiry_date"
  | "manufacture_date"
  | "mrp"
  | "rate"
  | "quantity"
  | "free_quantity"
  | "quantity_rejected"
  | "gst_rate"
  | "discount_amount"
  | "hsn_code";

const FIELDS: { name: LineField; label: string; type?: string }[] = [
  { name: "batch_number", label: "Batch" },
  { name: "expiry_date", label: "Expiry", type: "date" },
  { name: "manufacture_date", label: "Mfg date", type: "date" },
  { name: "quantity", label: "Billed qty" },
  { name: "free_quantity", label: "Free qty" },
  { name: "quantity_rejected", label: "Rejected" },
  { name: "rate", label: "Rate (₹)" },
  { name: "mrp", label: "MRP (₹)" },
  { name: "discount_amount", label: "Discount (₹)" },
  { name: "gst_rate", label: "GST %" },
  { name: "hsn_code", label: "HSN" },
];

function optionLabel(s: GrnItemSuggestion): string {
  const bits = [s.name, s.strength, s.dosage_form, s.pack_size ? `pack ${s.pack_size}` : null];
  const flag = s.is_controlled ? " · NDPS" : s.drug_schedule ? ` · Sch ${s.drug_schedule}` : "";
  return `${bits.filter(Boolean).join(" · ")} (${s.code})${flag}`;
}

function ItemPicker(props: {
  value: string;
  onChange: (v: string) => void;
  suggestions: GrnItemSuggestion[];
  error?: string;
  readName: string;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const found = useQuery({
    queryKey: ["grn-scan-item-search", term],
    queryFn: () => grnScanService.searchItems(term),
    enabled: term.length >= 2,
  });
  const data = useMemo(() => {
    const seen = new Set<string>();
    return [...props.suggestions, ...(found.data ?? [])]
      .filter((s) => !seen.has(s.catalog_item_id) && seen.add(s.catalog_item_id))
      .map((s) => ({ value: s.catalog_item_id, label: optionLabel(s) }));
  }, [props.suggestions, found.data]);
  return (
    <Select
      label="Catalogue item"
      description={
        props.suggestions.length > 0
          ? "Closest matches first; type to search the catalogue"
          : "No close match — type to search the catalogue"
      }
      placeholder={`Match “${props.readName}”`}
      data={data}
      value={props.value || null}
      onChange={(v) => props.onChange(v ?? "")}
      searchable
      onSearchChange={setSearch}
      nothingFoundMessage={found.isError ? "Search failed — try again" : "Nothing found"}
      error={props.error}
    />
  );
}

interface ScanLineCardProps {
  control: Control<GrnScanDraftFormInput>;
  idx: number;
  sourceIndex: number;
  readName: string;
  suggestions: GrnItemSuggestion[];
  messages: Map<string, LineMessage[]>;
  confidence: Record<string, number>;
  threshold: number;
  repeats: number | null;
  errors: FieldErrors<GrnScanDraftFormInput>;
  disabled: boolean;
  onRemove: () => void;
}

export function ScanLineCard(p: ScanLineCardProps) {
  const at = (f: string) => `lines[${p.sourceIndex}].${f}`;
  const message = (f: string) =>
    p.errors.lines?.[p.idx]?.[f as LineField]?.message ??
    p.messages
      .get(`${p.idx}.${f}`)
      ?.map((m) => m.message)
      .join(" ");
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={0}>
            <Text fw={600}>{p.readName || `Line ${p.idx + 1}`}</Text>
            <Text size="xs" c="dimmed">
              Line {p.idx + 1} as read from the bill
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            {p.repeats !== null && (
              <Badge tone="warning" leftSection={<IconAlertTriangle size={14} />}>
                Same as line {p.repeats + 1} — read twice?
              </Badge>
            )}
            <IconButton
              aria-label={`Remove line ${p.idx + 1}`}
              onClick={p.onRemove}
              disabled={p.disabled}
            >
              <IconTrash size={16} />
            </IconButton>
          </Group>
        </Group>
        <Controller
          control={p.control}
          name={`lines.${p.idx}.catalog_item_id`}
          render={({ field }) => (
            <ItemPicker
              value={field.value}
              onChange={field.onChange}
              suggestions={p.suggestions}
              readName={p.readName}
              error={message("catalog_item_id")}
            />
          )}
        />
        <SimpleGrid cols={{ base: 2, sm: 3, xl: 4 }} spacing="xs">
          {FIELDS.map((f) => {
            const unsure = needsCheck(p.confidence, at(f.name), p.threshold);
            return (
              <Controller
                key={f.name}
                control={p.control}
                name={`lines.${p.idx}.${f.name}`}
                render={({ field }) => (
                  <Input
                    label={f.label}
                    type={f.type}
                    size="xs"
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                    disabled={p.disabled}
                    leftSection={unsure ? <IconAlertTriangle size={14} aria-hidden /> : undefined}
                    description={unsure ? confidenceLabel(p.confidence, at(f.name)) : undefined}
                    error={message(f.name)}
                  />
                )}
              />
            );
          })}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
