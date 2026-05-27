import {
  Loader,
  Select,
  type ComboboxData,
  type ComboboxItem,
  type SelectProps,
} from "@mantine/core";
import type { TerminologySearchResult } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePacedQueryValue } from "../../hooks/usePacedQueryValue";
import { clinicalSupportService } from "../../services/clinicalSupport.service";

function isIcd11CodeFragment(value: string) {
  const query = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9.&-]*$/.test(query)) return false;
  return /[0-9.&-]/.test(query) || query.length <= 3;
}

function normalizeIcd11Query(value: string, selectedValue?: string | null, selectedLabel?: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isSelectedEcho =
    Boolean(selectedValue) &&
    (trimmed === selectedValue ||
      trimmed === selectedLabel ||
      trimmed.startsWith(`${selectedValue} ·`));
  if (isSelectedEcho) return "";
  const [codePart, labelPart] = trimmed.split("·").map((part) => part.trim());
  if (codePart && labelPart && isIcd11CodeFragment(codePart)) {
    return codePart;
  }
  return trimmed;
}

function canSearchIcd11Query(value: string) {
  const query = value.trim();
  return query.length >= 2;
}

function suggestionValue(value: string) {
  return `suggestion:${value}`;
}

function isSuggestionValue(value: string | null | undefined) {
  return Boolean(value?.startsWith("suggestion:"));
}

function suggestionLabel(value: string) {
  return value.replace(/^suggestion:/, "");
}

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
  onClear: externalOnClear,
  ...props
}: Icd11CodeSelectProps) {
  const [search, setSearch] = useState("");
  const [immediateSearch, setImmediateSearch] = useState<string | null>(null);
  const [dropdownOpened, setDropdownOpened] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(displayValue ?? null);
  const selectedLabel = value && selectedDisplay ? `${value} · ${selectedDisplay}` : value;
  const queryText = normalizeIcd11Query(search, value, selectedLabel ?? undefined);
  const pacedSearch = usePacedQueryValue(queryText, 300);
  const querySearch =
    immediateSearch && immediateSearch === queryText ? immediateSearch : pacedSearch;
  const searchEnabled = canSearchIcd11Query(querySearch);

  const { data, isFetching } = useQuery({
    queryKey: ["terminology-search-with-suggestions", "icd11", querySearch, limit],
    queryFn: () =>
      clinicalSupportService.searchTerminologyWithSuggestions({
        system: "icd11",
        q: querySearch,
        limit,
      }),
    enabled: searchEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const results: TerminologySearchResult[] = data?.results ?? [];
  const suggestions: string[] = data?.suggestions ?? [];

  const clearSelection = () => {
    setImmediateSearch(null);
    setDropdownOpened(false);
    setSelectedDisplay(null);
    setSearch("");
    onSearchTextChange?.("");
    onChange(undefined);
    externalOnClear?.();
  };

  const options = useMemo(() => {
    const seen = new Set<string>();
    const currentResults = searchEnabled && isFetching ? [] : results;
    const codeRows: ComboboxItem[] = currentResults.map((result) => {
      seen.add(result.code);
      return {
        value: result.code,
        label: `${result.code} · ${result.display}`,
      };
    });
    if (value && !seen.has(value)) {
      codeRows.unshift({
        value,
        label: selectedDisplay ? `${value} · ${selectedDisplay}` : value,
      });
    }
    const activeQuery = querySearch.trim().toLowerCase();
    const suggestionRows: ComboboxItem[] = (searchEnabled && isFetching ? [] : suggestions)
      .filter((suggestion) => suggestion.trim().toLowerCase() !== activeQuery)
      .map((suggestion) => ({
        value: suggestionValue(suggestion),
        label: suggestion,
      }));
    const groupedOptions: ComboboxData =
      suggestionRows.length > 0
        ? [
            {
              group: "ICD-11 codes",
              items: codeRows,
            },
            {
              group: "Suggested words",
              items: suggestionRows,
            },
          ]
        : [
            {
              group: "ICD-11 codes",
              items: codeRows,
            },
          ];
    return groupedOptions;
  }, [isFetching, querySearch, results, searchEnabled, selectedDisplay, suggestions, value]);

  return (
    <Select
      {...props}
      placeholder={placeholder}
      data={options}
      filter={({ options }) => options}
      value={value || null}
      searchValue={search}
      dropdownOpened={dropdownOpened}
      onDropdownOpen={() => setDropdownOpened(true)}
      onDropdownClose={() => setDropdownOpened(false)}
      onSearchChange={(nextSearch) => {
        setSearch(nextSearch);
        const nextQuery = normalizeIcd11Query(nextSearch, value, selectedLabel ?? undefined);
        setImmediateSearch((currentSearch) =>
          currentSearch && currentSearch !== nextQuery ? null : currentSearch,
        );
        if (nextQuery) {
          onSearchTextChange?.(nextQuery);
        }
      }}
      onChange={(nextValue) => {
        if (isSuggestionValue(nextValue)) {
          const nextSearch = suggestionLabel(nextValue ?? "");
          const nextQuery = normalizeIcd11Query(nextSearch, value, selectedLabel ?? undefined);
          setSearch(nextSearch);
          setImmediateSearch(nextQuery);
          setDropdownOpened(true);
          window.setTimeout(() => setDropdownOpened(true), 0);
          onSearchTextChange?.(nextQuery || nextSearch);
          return;
        }
        if (!nextValue) {
          clearSelection();
          return;
        }
        setImmediateSearch(null);
        setDropdownOpened(false);
        onChange(nextValue);
        const result = results.find((item) => item.code === nextValue);
        if (result) {
          setSelectedDisplay(result.display);
          setSearch("");
          onSelectResult?.(result);
        }
      }}
      onClear={clearSelection}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={
        isFetching
          ? "Loading ICD-11 matches..."
          : !searchEnabled
            ? "Type a code fragment or at least 2 letters"
            : "No ICD-11 match"
      }
      searchable
      clearable
    />
  );
}
