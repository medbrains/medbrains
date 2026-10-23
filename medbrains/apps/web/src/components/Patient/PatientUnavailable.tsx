/**
 * A patient record this user cannot open. The server answers "not found"
 * whether the record is absent or simply not theirs to see, so the screen
 * says neither. A clinician allowed to break the glass can open it in an
 * emergency.
 */
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconLockOpen } from "@tabler/icons-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { BreakGlassModal } from "./BreakGlassModal";

interface PatientUnavailableProps {
  patientId: string;
}

export function PatientUnavailable({ patientId }: PatientUnavailableProps) {
  const canBreakGlass = useHasPermission(P.AUDIT.BREAK_GLASS_START);
  const [open, setOpen] = useState(false);

  return (
    <>
      <EmptyState
        icon={<IconLockOpen size={32} />}
        title="This patient record isn't available to you"
        description="It may not exist, or it belongs to patients outside your care. Ask the treating team, or your administrator, for access."
        action={
          canBreakGlass ? { label: "Emergency access", onClick: () => setOpen(true) } : undefined
        }
      />
      <BreakGlassModal patientId={patientId} opened={open} onClose={() => setOpen(false)} />
    </>
  );
}
