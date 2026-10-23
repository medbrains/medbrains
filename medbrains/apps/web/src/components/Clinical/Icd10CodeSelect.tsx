import { Loader, Select, type SelectProps } from "@mantine/core";
import type { TerminologySearchResult } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { ICD10_NOT_LOADED } from "@/services/diagnosisCoding.service";

type Icd10CodeSelectProps = Omit<
  SelectProps,
  "data" | "value" | "onChange" | "searchValue" | "onSearchChange" | "rightSection"
> & {
  value?: string | null;
  /** False when the hospital has loaded no ICD-10 catalogue. */
  catalogueLoaded: boolean;
  limit?: number;
  onChange: (value: string | undefined) => void;
  onSelectResult?: (result: TerminologySearchResult) => void;
};

const MIN_QUERY = 2;

function nothingFound(isFetching: boolean, isError: boolean, query: string) {
  if (isError) return "ICD-10 search failed — try again";
  if (isFetching) return "Loading ICD-10 matches...";
  if (query.length < MIN_QUERY) return "Type a code or at least 2 letters";
  return "No ICD-10 match";
}

/** Searches the hospital's own licensed ICD-10 catalogue. */
export function Icd10CodeSelect({
  value,
  catalogueLoaded,
  limit = 15,
  placeholder = "Search ICD-10",
  onChange,
  onSelectResult,
  ...props
}: Icd10CodeSelectProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TerminologySearchResult | null>(null);
  const query = usePacedQueryValue(search.trim(), 300);
  const isEcho = Boolean(selected) && search === `${selected?.code} · ${selected?.display}`;
  const enabled = catalogueLoaded && query.length >= MIN_QUERY && !isEcho;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["terminology-search", "icd10", query, limit],
    queryFn: () => clinicalSupportService.searchTerminology({ system: "icd10", q: query, limit }),
    enabled,
    retry: false,
  });
  const results = useMemo(() => data ?? [], [data]);

  const options = useMemo(() => {
    const rows = results.map((r) => ({ value: r.code, label: `${r.code} · ${r.display}` }));
    if (value && !rows.some((r) => r.value === value)) {
      rows.unshift({ value, label: selected ? `${value} · ${selected.display}` : value });
    }
    return rows;
  }, [results, selected, value]);

  if (!catalogueLoaded) {
    return (
      <Select
        {...props}
        data={[]}
        placeholder={ICD10_NOT_LOADED}
        error={ICD10_NOT_LOADED}
        disabled
      />
    );
  }

  return (
    <Select
      {...props}
      placeholder={placeholder}
      data={options}
      filter={({ options: all }) => all}
      value={value || null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(next) => {
        const result = results.find((r) => r.code === next) ?? null;
        setSelected(result);
        onChange(next ?? undefined);
        if (result) onSelectResult?.(result);
      }}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={nothingFound(isFetching, isError, query)}
      searchable
      clearable
    />
  );
}
