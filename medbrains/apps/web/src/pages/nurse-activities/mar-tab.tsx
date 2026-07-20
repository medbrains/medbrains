// IPD MarTab — split from nurse-activities.tsx (pure move).

import { MedicationRound } from "@/components/Nurse/MedicationRound";

export function MarTab({ patientId }: { patientId: string }) {
  return <MedicationRound patientId={patientId || undefined} />;
}

// ── I/O Tab ─────────────────────────────────────────────────────────
