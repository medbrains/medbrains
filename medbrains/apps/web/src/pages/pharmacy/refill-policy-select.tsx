import type { PharmacyCatalog, RefillPolicy } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

/** Who may let a refill through when a patient asks for one. */
export const REFILL_POLICY_OPTIONS: { value: RefillPolicy; label: string }[] = [
  { value: "pharmacy", label: "Pharmacy may refill" },
  { value: "doctor_approval", label: "Doctor approves" },
  { value: "never", label: "Not on request" },
];

/** Schedule X, H1 and NDPS are never refilled, whatever the row says. */
export function isNeverRefilled(row: Pick<PharmacyCatalog, "is_controlled" | "drug_schedule">) {
  return row.is_controlled || ["X", "H1", "NDPS"].includes(row.drug_schedule ?? "");
}

interface RefillPolicySelectProps {
  row: PharmacyCatalog;
  canManage: boolean;
}

/** A catalogue row's refill policy, changed in place. */
export function RefillPolicySelect({ row, canManage }: RefillPolicySelectProps) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (refill_policy: RefillPolicy) =>
      pharmacyService.updatePharmacyCatalog(row.id, { refill_policy }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Refill policy not changed" }),
  });
  const controlled = isNeverRefilled(row);

  return (
    <Select
      aria-label={`Refills on request for ${row.name}`}
      size="xs"
      w={170}
      data={REFILL_POLICY_OPTIONS}
      value={controlled ? "never" : row.refill_policy}
      disabled={controlled || !canManage || update.isPending}
      description={controlled ? "Controlled drug" : undefined}
      allowDeselect={false}
      onChange={(value) => value && update.mutate(value as RefillPolicy)}
    />
  );
}
