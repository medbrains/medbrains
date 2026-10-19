import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@medbrains/api";
import type { PharmacyCatalog } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";

/** Characters typed before the formulary is searched; one letter matches half of it. */
const MIN_SEARCH = 2;

interface FormularyPickerProps {
  /** The prescribed text this line is being mapped from, for the label. */
  drugName: string;
  onPick: (item: PharmacyCatalog) => void;
}

/**
 * Map a prescription line the formulary could not match to an actual
 * product. Searched on the server (name, generic name, code) as the
 * pharmacist types, never the whole catalogue at once.
 */
export function FormularyPicker({ drugName, onPick }: FormularyPickerProps) {
  const { t } = useTranslation("pharmacy");
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 250);
  const results = useQuery({
    queryKey: ["pharmacy-catalog-search", debounced],
    queryFn: () => api.listPharmacyCatalog({ search: debounced }),
    enabled: debounced.length >= MIN_SEARCH,
    staleTime: 60_000,
  });
  const byId = useMemo(
    () => new Map((results.data ?? []).filter((c) => c.is_active).map((c) => [c.id, c])),
    [results.data],
  );
  const options = useMemo(
    () =>
      [...byId.values()].map((c) => ({
        value: c.id,
        label: [c.name, c.generic_name, `₹${Number(c.base_price).toFixed(2)}`]
          .filter(Boolean)
          .join(" · "),
      })),
    [byId],
  );

  return (
    <Select
      size="xs"
      label={t("rxBillingEstimate.mapLabel", { drug: drugName })}
      placeholder={t("rxBillingEstimate.mapPlaceholder")}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      data={options}
      value={null}
      onChange={(id) => {
        const item = id ? byId.get(id) : undefined;
        if (item) onPick(item);
      }}
      nothingFoundMessage={
        debounced.length < MIN_SEARCH
          ? t("rxBillingEstimate.mapTypeMore")
          : results.isError
            ? t("rxBillingEstimate.mapSearchFailed")
            : results.isFetching
              ? t("rxBillingEstimate.mapSearching")
              : t("rxBillingEstimate.mapNoMatch")
      }
      filter={({ options: all }) => all}
    />
  );
}
