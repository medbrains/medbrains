import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychPatient } from "@medbrains/types";
import { useState } from "react";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Panel } from "@/components/ui";
import { AssessmentsTab } from "./AssessmentsTab";
import { CounselingTab } from "./CounselingTab";
import { EctTab } from "./EctTab";
import { MhrbTab } from "./MhrbTab";
import { PsychOverviewTab } from "./PsychOverviewTab";
import { RestraintTab } from "./RestraintTab";

/** One patient's psychiatric record. Tabs appear only for what the role may read. */
export function PsychRecordPanel({ record }: { record: PsychPatient }) {
  const [tab, setTab] = useState<string | null>("overview");
  const canAssess = useHasPermission(P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST);
  const canEct = useHasPermission(P.SPECIALTY.PSYCHIATRY.ECT_LIST);
  const canRestraint = useHasPermission(P.SPECIALTY.PSYCHIATRY.RESTRAINT_LIST);
  const canMhrb = useHasPermission(P.SPECIALTY.PSYCHIATRY.MHRB_MANAGE);

  return (
    <Panel title="Psychiatric record">
      <PatientNameCell patientId={record.patient_id} />
      <Tabs value={tab} onChange={setTab} keepMounted={false} mt="sm">
        <Tabs.List>
          <Tabs.Tab value="overview">Record</Tabs.Tab>
          {canAssess && <Tabs.Tab value="assessments">Assessments</Tabs.Tab>}
          {canAssess && <Tabs.Tab value="counseling">Counselling</Tabs.Tab>}
          {canEct && <Tabs.Tab value="ect">ECT register</Tabs.Tab>}
          {canRestraint && <Tabs.Tab value="restraint">Seclusion and restraint</Tabs.Tab>}
          {canMhrb && <Tabs.Tab value="mhrb">Review Board</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="overview" pt="md">
          <PsychOverviewTab record={record} />
        </Tabs.Panel>
        <Tabs.Panel value="assessments" pt="md">
          <AssessmentsTab psychPatientId={record.id} />
        </Tabs.Panel>
        <Tabs.Panel value="counseling" pt="md">
          <CounselingTab psychPatientId={record.id} />
        </Tabs.Panel>
        <Tabs.Panel value="ect" pt="md">
          <EctTab psychPatientId={record.id} />
        </Tabs.Panel>
        <Tabs.Panel value="restraint" pt="md">
          <RestraintTab psychPatientId={record.id} />
        </Tabs.Panel>
        <Tabs.Panel value="mhrb" pt="md">
          <MhrbTab psychPatientId={record.id} />
        </Tabs.Panel>
      </Tabs>
    </Panel>
  );
}
