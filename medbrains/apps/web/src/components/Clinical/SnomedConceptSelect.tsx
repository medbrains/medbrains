import { type ComboboxItem, Group, Loader, Stack, Text } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import { P, type SnomedConceptHit } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Select, type SelectProps } from "@/components/ui";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { SNOMED_NOT_LOADED, snomedService } from "@/services/snomed.service";

const MIN_CHARS = 3;
const SEARCH_LIMIT = 20;

type SnomedConceptSelectProps = Omit<
  SelectProps,
  "data" | "value" | "onChange" | "searchValue" | "onSearchChange" | "filter" | "renderOption"
> & {
  /** The chosen SCTID — always a string; SCTIDs exceed the safe integer range. */
  value: string | null;
  /** Its term, so a saved value reads as words before any search runs. */
  displayValue?: string | null;
  /** Narrow to one hierarchy, e.g. `disorder` or `substance`. */
  semanticTag?: string;
  onChange: (hit: SnomedConceptHit | null) => void;
};

function hitLabel(hit: SnomedConceptHit) {
  return hit.preferred_term ?? hit.fsn ?? hit.concept_id;
}

/**
 * Pick a SNOMED CT concept by any of its terms or its id. Shows the
 * preferred term, semantic tag and id; says plainly when no release is
 * loaded instead of showing an empty list.
 */
export function SnomedConceptSelect({
  value,
  displayValue,
  semanticTag,
  onChange,
  placeholder = "Search SNOMED CT",
  ...props
}: SnomedConceptSelectProps) {
  const canSearch = useHasAnyPermission([
    P.TERMINOLOGY.SNOMED.VIEW,
    P.TERMINOLOGY.SNOMED.ANALYTICS,
  ]);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<SnomedConceptHit | null>(null);
  const paced = usePacedQueryValue(search.trim(), 300);
  const enabled = canSearch && paced.length >= MIN_CHARS;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["snomed-search", paced, semanticTag ?? null],
    queryFn: () =>
      snomedService.search({ q: paced, limit: SEARCH_LIMIT, semantic_tag: semanticTag }),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const hits = useMemo(() => {
    const byId = new Map<string, SnomedConceptHit>();
    for (const hit of data?.results ?? []) byId.set(hit.concept_id, hit);
    if (chosen && !byId.has(chosen.concept_id)) byId.set(chosen.concept_id, chosen);
    return byId;
  }, [data, chosen]);

  const options = useMemo<ComboboxItem[]>(() => {
    const rows = [...hits.values()].map((hit) => ({ value: hit.concept_id, label: hitLabel(hit) }));
    if (value && !hits.has(value)) rows.unshift({ value, label: displayValue ?? value });
    return rows;
  }, [hits, value, displayValue]);

  const nothingFound = !enabled
    ? `Type at least ${MIN_CHARS} letters or a concept id`
    : isError
      ? "SNOMED CT search is unavailable — try again"
      : data && !data.loaded
        ? SNOMED_NOT_LOADED
        : "No SNOMED CT concept matches";

  return (
    <Select
      {...props}
      placeholder={placeholder}
      searchable
      clearable
      data={options}
      value={value}
      searchValue={search}
      onSearchChange={setSearch}
      filter={({ options: all }) => all}
      nothingFoundMessage={isFetching ? "Searching…" : nothingFound}
      rightSection={isFetching ? <Loader size="xs" /> : undefined}
      onChange={(next) => {
        const hit = next ? (hits.get(next) ?? null) : null;
        setChosen(hit);
        onChange(hit);
      }}
      renderOption={({ option }) => {
        const hit = hits.get(option.value);
        return (
          <Stack gap={0}>
            <Text size="sm">{option.label}</Text>
            <Group gap="xs">
              {hit?.semantic_tag && (
                <Text size="xs" c="dimmed">
                  {hit.semantic_tag}
                </Text>
              )}
              <Text size="xs" c="dimmed" ff="monospace">
                {option.value}
              </Text>
              {hit?.matched_term && (
                <Text size="xs" c="dimmed">
                  matched “{hit.matched_term}”
                </Text>
              )}
            </Group>
          </Stack>
        );
      }}
    />
  );
}
