import { Loader, Select, type SelectProps } from "@mantine/core";
import type { TerminologySearchResult } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePacedQueryValue } from "../../hooks/usePacedQueryValue";
import { clinicalSupportService } from "../../services/clinicalSupport.service";

type Icd11CodeSelectProps = Omit<
  SelectProps,
  "data" | "value" | "onChange" | "searchValue" | "onSearchChange" | "rightSection"
> & {
  value?: string | null;
  displayValue?: string | null;
  limit?: number;
  onChange: (value: string | undefined) => void;
  onSelectResult?: (result: TerminologySearchResult) => void;
  onSearchTextChange?: (value: string) => void;
};

export function Icd11CodeSelect({
  value,
  displayValue,
  limit = 15,
  placeholder = "Search ICD-11",
  onChange,
  onSelectResult,
  onSearchTextChange,
  ...props
}: Icd11CodeSelectProps) {
  const [search, setSearch] = useState("");
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(displayValue ?? null);
  const selectedLabel = value && selectedDisplay ? `${value} · ${selectedDisplay}` : value;
  const searchText = search.trim();
  const isSelectedEcho =
    Boolean(value) &&
    (searchText === value || searchText === selectedLabel || searchText.startsWith(`${value} ·`));
  const queryText = isSelectedEcho ? "" : searchText;
  const pacedSearch = usePacedQueryValue(queryText, 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["terminology-search", "icd11", pacedSearch, limit],
    queryFn: () =>
      clinicalSupportService.searchTerminology({
        system: "icd11",
        q: pacedSearch,
        limit,
      }),
    enabled: pacedSearch.length >= 2,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const options = useMemo(() => {
    const seen = new Set<string>();
    const currentResults = pacedSearch.length >= 2 && isFetching ? [] : results;
    const rows = currentResults.map((result) => {
      seen.add(result.code);
      return {
        value: result.code,
        label: `${result.code} · ${result.display}`,
      };
    });
    if (value && !seen.has(value)) {
      rows.unshift({
        value,
        label: selectedDisplay ? `${value} · ${selectedDisplay}` : value,
      });
    }
    return rows;
  }, [isFetching, pacedSearch.length, results, selectedDisplay, value]);

  return (
    <Select
      {...props}
      placeholder={placeholder}
      data={options}
      filter={({ options }) => options}
      value={value || null}
      searchValue={search}
      onSearchChange={(nextSearch) => {
        setSearch(nextSearch);
        const nextText = nextSearch.trim();
        const nextIsSelectedEcho =
          Boolean(value) &&
          (nextText === value || nextText === selectedLabel || nextText.startsWith(`${value} ·`));
        if (!nextIsSelectedEcho) {
          onSearchTextChange?.(nextSearch);
        }
      }}
      onChange={(nextValue) => {
        onChange(nextValue ?? undefined);
        const result = results.find((item) => item.code === nextValue);
        if (result) {
          setSelectedDisplay(result.display);
          setSearch("");
          onSelectResult?.(result);
        } else if (!nextValue) {
          setSelectedDisplay(null);
          setSearch("");
        }
      }}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={
        isFetching
          ? "Loading ICD-11 matches..."
          : pacedSearch.length < 2
            ? "Type at least 2 characters"
            : "No ICD-11 match"
      }
      searchable
      clearable
    />
  );
}
