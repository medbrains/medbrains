import type { PharmacyCatalog } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

interface ColdChainSwitchProps {
  row: PharmacyCatalog;
  canManage: boolean;
}

/** Needs refrigeration: such a drug is delivered by the hospital's runner, never by courier. */
export function ColdChainSwitch({ row, canManage }: ColdChainSwitchProps) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (needs_cold_chain: boolean) =>
      pharmacyService.updatePharmacyCatalog(row.id, { needs_cold_chain }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  return (
    <Switch
      aria-label={`${row.name} needs refrigeration`}
      checked={row.needs_cold_chain}
      disabled={!canManage || update.isPending}
      onChange={(e) => update.mutate(e.currentTarget.checked)}
    />
  );
}
