// The active camps a camp OPD visit can be filed under.

import type { Camp } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { campService } from "@/services/camp.service";

/**
 * The active camps a camp OPD visit can be filed under, as select options.
 * `failed` says the list did not load, so the form never shows "no camps"
 * for an outage.
 */
export function useActiveCampOptions() {
  const { data, isError } = useQuery<Camp[]>({
    queryKey: ["camps", "active-for-opd"],
    queryFn: () => campService.listCamps({ status: "active" }),
    staleTime: 300_000,
  });
  const options = useMemo(
    () => data?.map((camp) => ({ value: camp.id, label: `${camp.camp_code} - ${camp.name}` })),
    [data],
  );
  return { options, failed: isError };
}
