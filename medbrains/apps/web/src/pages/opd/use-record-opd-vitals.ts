import { useHasPermission } from "@medbrains/stores";
import type { CreateVitalRequest, Vital } from "@medbrains/types";
import { P } from "@medbrains/types";
import { opdService } from "@/services/opd.service";

/**
 * Who may record an OPD patient's vitals, and by which call.
 *
 * Two endpoints write the same reading and each has its own permission: the
 * nursing one (`nurse.vitals.record`, which also scores the reading) and the
 * OPD one (`opd.vitals.create`). Every screen that offers "Record vitals"
 * takes its gate and its call from here, so the button is shown exactly when
 * the call it makes will be allowed. The vitals counter asked for
 * `opd.vitals.create` alone and showed the built-in Nurse role a list with
 * no button.
 */
export function useRecordOpdVitals(): {
  canRecord: boolean;
  recordVitals: (encounterId: string, vitals: CreateVitalRequest) => Promise<Vital>;
} {
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS.RECORD);
  const canCreateOpdVitals = useHasPermission(P.OPD.VITALS.CREATE);
  return {
    canRecord: canRecordNurseVitals || canCreateOpdVitals,
    recordVitals: (encounterId, vitals) =>
      canRecordNurseVitals
        ? opdService.createNurseVital({ ...vitals, encounter_id: encounterId })
        : opdService.createVital(encounterId, vitals),
  };
}
