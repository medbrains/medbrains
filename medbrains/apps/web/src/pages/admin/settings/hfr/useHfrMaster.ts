import type { HfrMasterKind } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { abdmRegistryService } from "@/services/abdmRegistry.service";

/** HFR master lists change rarely; an hour keeps a sitting's dropdowns stable. */
const MASTER_STALE_MS = 60 * 60 * 1000;
const NO_OPTIONS: { value: string; label: string }[] = [];

/**
 * One HFR master list for a dropdown, as `{ value, label }`. Every dropdown
 * is filled from HFR and sends the code (workbook: codes, not names). A list
 * that hangs off a parent choice waits for it (`enabled`). The error is
 * returned so the field can say the list failed — never an empty list.
 */
export function useHfrMaster(kind: HfrMasterKind, code = "", code2 = "", enabled = true) {
  const query = useQuery({
    queryKey: ["abdm-hfr-master", kind, code, code2],
    queryFn: () => abdmRegistryService.getHfrMaster(kind, code, code2),
    enabled,
    staleTime: MASTER_STALE_MS,
  });
  const options = query.data;
  // Not yet loaded or failed is no options *and* `error` below — never a silent empty list.
  const data = useMemo(
    () => (options ? options.map((o) => ({ value: o.code, label: o.name })) : NO_OPTIONS),
    [options],
  );
  const error = query.isError ? "Could not load this list from HFR. Try again." : undefined;
  return { data, isLoading: query.isLoading, error, refetch: query.refetch };
}
