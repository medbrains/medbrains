import type { PharmacyCatalog } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

interface PatientBillableSwitchProps {
  row: PharmacyCatalog;
  canManage: boolean;
}

/**
 * Billed to the patient when a nurse uses it from ward stock on them. Off for
 * overhead and items the bed charge already covers; off for every item until
 * the hospital turns it on.
 */
export function PatientBillableSwitch({ row, canManage }: PatientBillableSwitchProps) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (is_patient_billable: boolean) =>
      pharmacyService.updatePharmacyCatalog(row.id, { is_patient_billable }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  return (
    <Switch
      aria-label={`Bill ${row.name} to the patient from ward stock`}
      checked={row.is_patient_billable}
      disabled={!canManage || update.isPending}
      onChange={(e) => update.mutate(e.currentTarget.checked)}
    />
  );
}
