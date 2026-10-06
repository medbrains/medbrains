import type { SetupUser } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { toast } from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";

/**
 * The consultant whose countersignature this doctor's clinical notes need.
 * Saved as soon as it is chosen; clearing it stops asking for one.
 */
export function UserSupervisorField({ user }: { user: SetupUser }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(user.supervisor_id ?? "");
  const save = useMutation({
    mutationFn: (supervisorId: string) =>
      adminAccessService.setUserSupervisor(user.id, supervisorId || null),
    onSuccess: (_, supervisorId) => {
      setValue(supervisorId);
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      toast.success(supervisorId ? "Countersigning consultant set" : "Countersigning cleared");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not saved" }),
  });
  return (
    <DoctorSearchSelect
      label="Notes countersigned by"
      placeholder="No countersign needed"
      value={value}
      onChange={(id) => save.mutate(id)}
      disabled={save.isPending}
    />
  );
}
