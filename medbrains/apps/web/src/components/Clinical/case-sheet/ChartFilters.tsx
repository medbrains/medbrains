import { SimpleGrid } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { ChartFacet, ChartQuery } from "@medbrains/types";
import { Select } from "@/components/ui";

export type ChartFilterValue = Omit<ChartQuery, "before_at" | "before_id">;

const STATUS_OPTIONS = [
  { value: "signed", label: "Signed" },
  { value: "draft", label: "Drafts" },
  { value: "entered_in_error", label: "Entered in error" },
];

interface ChartFiltersProps {
  facets: ChartFacet[];
  value: ChartFilterValue;
  onChange: (next: ChartFilterValue) => void;
}

/** Narrow the record by what is on it: type, author, department, status, dates. */
export function ChartFilters({ facets, value, onChange }: ChartFiltersProps) {
  const options = (kind: ChartFacet["kind"]) =>
    facets.filter((f) => f.kind === kind).map((f) => ({ value: f.value, label: f.label }));
  const set = (patch: ChartFilterValue) => onChange({ ...value, ...patch });
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
      <Select
        label="Note type"
        placeholder="All types"
        data={options("note_type")}
        value={value.note_type ?? null}
        onChange={(v) => set({ note_type: v ?? undefined })}
        clearable
      />
      <Select
        label="Author"
        placeholder="Anyone"
        data={options("author")}
        value={value.author_id ?? null}
        onChange={(v) => set({ author_id: v ?? undefined })}
        searchable
        clearable
      />
      <Select
        label="Department"
        placeholder="All departments"
        data={options("department")}
        value={value.department_id ?? null}
        onChange={(v) => set({ department_id: v ?? undefined })}
        clearable
      />
      <Select
        label="Status"
        placeholder="All but entered in error"
        data={STATUS_OPTIONS}
        value={value.status ?? null}
        onChange={(v) => set({ status: (v as ChartFilterValue["status"]) ?? undefined })}
        clearable
      />
      <DatePickerInput
        type="range"
        label="Care between"
        placeholder="Any date"
        value={[value.from ?? null, value.to ?? null]}
        onChange={([from, to]) => set({ from: from ?? undefined, to: to ?? undefined })}
        clearable
        size="sm"
      />
    </SimpleGrid>
  );
}

/** The filters as the server reads them: local days become instants, and
 *  the range's last day is included, so its bound is the next midnight. */
export function chartQuery(filters: ChartFilterValue): ChartQuery {
  const midnight = (date: string, addDays = 0) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + addDays);
    return d.toISOString();
  };
  return {
    ...filters,
    from: filters.from ? midnight(filters.from) : undefined,
    to: filters.to ? midnight(filters.to, 1) : undefined,
  };
}
