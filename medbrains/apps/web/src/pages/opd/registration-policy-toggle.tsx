// Opd OpdRegistrationPolicyToggle — split from opd.tsx (pure move).

import { Switch } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { opdService } from "@/services/opd.service";

export function OpdRegistrationPolicyToggle() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL_MANAGE);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["opd-registration-policy"],
    queryFn: () => opdService.getRegistrationPolicy(),
    enabled: canManage,
  });
  const mutation = useMutation({
    mutationFn: (require_opd_registration: boolean) =>
      opdService.updateRegistrationPolicy({ require_opd_registration }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["opd-registration-policy"] }),
  });
  if (!canManage) return null;
  return (
    <Switch
      label="Lock records until OPD registered"
      checked={data?.require_opd_registration ?? false}
      onChange={(e) => mutation.mutate(e.currentTarget.checked)}
      disabled={mutation.isPending}
    />
  );
}
