// One Prescriptions tab for the encounter: writing today's Rx, earlier Rx and
// the pharmacy's progress used to be three separate tabs a doctor hunted for.

import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import { PharmacyDispatchTab } from "./pharmacy-dispatch";
import { PrescriptionsTab } from "./prescriptions";
import { RxHistoryTab } from "./workflow-tabs";

type RxView = "visit" | "past" | "pharmacy";

const RX_VIEWS: { value: RxView; label: string }[] = [
  { value: "visit", label: "This visit" },
  { value: "past", label: "Past" },
  { value: "pharmacy", label: "Pharmacy" },
];

interface PrescriptionsWorkspaceProps {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  canUpdate: boolean;
  allergies: string[];
}

export function PrescriptionsWorkspace(props: PrescriptionsWorkspaceProps) {
  const [view, setView] = useState<RxView>("visit");
  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label="Prescription view"
        data={RX_VIEWS}
        value={view}
        onChange={(v) => setView(v as RxView)}
        w="fit-content"
      />
      {view === "visit" && <PrescriptionsTab {...props} />}
      {view === "past" && <RxHistoryTab patientId={props.patientId} />}
      {view === "pharmacy" && <PharmacyDispatchTab encounterId={props.encounterId} />}
    </Stack>
  );
}
