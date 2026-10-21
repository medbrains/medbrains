import { Loader, Stack, Text } from "@mantine/core";
import type { AbhaField, AbhaVerificationStep, AbhaVerifiedProfile } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal } from "@/components/ui";
import { abdmScanShareService } from "@/services/abdmScanShare.service";
import { abhaService } from "@/services/abha.service";
import { patientsService } from "@/services/patients.service";
import { AbhaCompare, compareRows, type OurDetails } from "./AbhaCompare";

export interface ScanShareCompareTarget {
  shareId: string;
  /** The verification the server recorded from the share. */
  step: AbhaVerificationStep;
  patientId: string;
}

interface ScanShareCompareDrawerProps {
  target: ScanShareCompareTarget | null;
  onClose: () => void;
  onDone: (patientId: string) => void;
}

/**
 * A shared ABHA profile beside the patient's record: where they differ, the
 * desk chooses which to keep, then the ABHA is linked (through the verified
 * path) and the share is marked dealt with.
 */
export function ScanShareCompareDrawer({ target, onClose, onDone }: ScanShareCompareDrawerProps) {
  return (
    <Modal opened={target !== null} onClose={onClose} title="Compare and link" fullScreen>
      {target?.step.profile && (
        <CompareBody target={target} profile={target.step.profile} onDone={onDone} />
      )}
    </Modal>
  );
}

interface CompareBodyProps {
  target: ScanShareCompareTarget;
  profile: AbhaVerifiedProfile;
  onDone: (patientId: string) => void;
}

function CompareBody({ target, profile, onDone }: CompareBodyProps) {
  const [apply, setApply] = useState<AbhaField[] | null>(null);
  const patient = useQuery({
    queryKey: ["patient", target.patientId],
    queryFn: () => patientsService.getPatient(target.patientId),
  });
  const link = useMutation({
    mutationFn: async (fields: AbhaField[]) => {
      await abhaService.link(target.step.id, { patient_id: target.patientId, apply: fields });
      return abdmScanShareService.complete(target.shareId, { patient_id: target.patientId });
    },
    onSuccess: () => onDone(target.patientId),
  });

  if (patient.isLoading) return <Loader size="sm" />;
  if (patient.isError || !patient.data) {
    return (
      <Alert tone="danger" title="Could not load the patient">
        The record failed to load; nothing was changed.
      </Alert>
    );
  }
  const p = patient.data;
  const ours: OurDetails = {
    first_name: p.first_name,
    middle_name: p.middle_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
  };
  // Until staff choose, keep our record: a local spelling may be deliberate.
  const chosen = apply ?? [];
  const differs = compareRows(profile, ours).some(
    (r) => r.abha && r.abha.toLowerCase() !== r.ours.toLowerCase(),
  );

  return (
    <Stack>
      <Text size="sm">
        {p.uhid} · {[p.first_name, p.last_name].filter(Boolean).join(" ")}
      </Text>
      {!differs && <Text size="sm">The shared profile matches this record.</Text>}
      <AbhaCompare profile={profile} ours={ours} apply={chosen} onApplyChange={setApply} />
      {link.isError && (
        <Alert tone="danger" title="Could not link the ABHA">
          {link.error.message}
        </Alert>
      )}
      <Button tone="primary" loading={link.isPending} onClick={() => link.mutate(chosen)}>
        Link to this patient
      </Button>
    </Stack>
  );
}
