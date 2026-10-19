import type { PharmacyCatalog, StorefrontListing } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

interface OnlineListingSwitchProps {
  row: PharmacyCatalog;
  field: keyof StorefrontListing;
  canManage: boolean;
}

const LABEL: Record<keyof StorefrontListing, string> = {
  sold_online: "sold online",
  habit_forming: "habit-forming",
};

/**
 * Put an item on the storefront (off until a pharmacist turns it on), or
 * mark it habit-forming — pickup only and a unit cap online.
 */
export function OnlineListingSwitch({ row, field, canManage }: OnlineListingSwitchProps) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (value: boolean) =>
      storefrontService.setStorefrontListing(row.id, { [field]: value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  return (
    <Switch
      aria-label={`${row.name} ${LABEL[field]}`}
      checked={row[field]}
      disabled={!canManage || update.isPending}
      onChange={(e) => update.mutate(e.currentTarget.checked)}
    />
  );
}
