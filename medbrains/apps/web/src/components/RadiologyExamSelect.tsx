import { Box, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { RadiologyExamListItem } from "@medbrains/types";
import { IconRadar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { contrastLabel } from "@/lib/radiology-exams";
import { searchErrorText } from "@/lib/search-error";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { SearchOrCreate } from "./SearchOrCreate";

const SEARCH_LIMIT = 25;

interface RadiologyExamSelectProps {
  /** Exams are listed for this modality only; the picker waits for it. */
  modalityId: string;
  value: string;
  onChange: (exam: RadiologyExamListItem | null) => void;
}

/**
 * Optional exam picker under a chosen modality. An empty box lists the
 * modality's exams; typing ranks by code, short name and name on the server.
 */
export function RadiologyExamSelect({ modalityId, value, onChange }: RadiologyExamSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const query = debounced.trim();
  const { data, isFetching, error } = useQuery({
    queryKey: ["radiology-exam-search", modalityId, query],
    queryFn: () =>
      clinicalSupportService.listRadiologyExams({
        modality_id: modalityId,
        search: query || undefined,
        limit: SEARCH_LIMIT,
      }),
    enabled: Boolean(modalityId),
    staleTime: 60_000,
  });

  return (
    <SearchOrCreate<RadiologyExamListItem>
      label="Exam"
      placeholder={modalityId ? "Search exam, e.g. CT brain, NCCT head" : "Pick a modality first"}
      disabled={!modalityId}
      value={value}
      items={data ?? []}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={0}
      loading={isFetching || search.trim() !== query}
      fetchError={searchErrorText(error, "exams")}
      getItemValue={(exam) => exam.id}
      getItemDisplay={(exam) => `${exam.name} (${exam.code})`}
      onSelect={onChange}
      onClear={() => onChange(null)}
      leftSection={<IconRadar size={14} />}
      emptyLabel="No exam by that name for this modality — order by body part instead"
      typeToSearchLabel="No exams set up for this modality"
      renderItem={(exam) => (
        <Group gap={8} wrap="nowrap" justify="space-between">
          <Box flex={1}>
            <Text size="sm" fw={500}>
              {exam.name}
            </Text>
            <Text size="xs" c="dimmed">
              {exam.code}
              {exam.body_part ? ` · ${exam.body_part}` : ""} · {contrastLabel(exam.contrast)}
            </Text>
          </Box>
        </Group>
      )}
    />
  );
}
