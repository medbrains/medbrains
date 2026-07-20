// Emergency EmergencyVisitCreatePage — split from emergency.tsx (pure move).

import { Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { ClinicalEventProvider } from "@/components/ClinicalEventProvider";
import { Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { EmergencyVisitForm } from "./visit-form";

export function EmergencyVisitCreatePage() {
  useRequirePermission(P.EMERGENCY.VISITS_CREATE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";
  const canCreateMlc = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  function visitsPath() {
    const params = new URLSearchParams({ tab: "visits" });
    if (initialPatientId) {
      params.set("patient_id", initialPatientId);
    }
    return `/emergency?${params.toString()}`;
  }

  return (
    <ClinicalEventProvider moduleCode="emergency" contextCode="emergency-create-visit">
      <Stack>
        <PageHeader
          title="Register ER Visit"
          subtitle="Create an emergency visit with patient context, MLC flagging, and triage-ready status."
          actions={
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(visitsPath())}
            >
              ER Queue
            </Button>
          }
        />
        <EmergencyVisitForm
          initialPatientId={initialPatientId}
          canCreateMlc={canCreateMlc}
          canViewPatientRecord={canViewPatientRecord}
          onCancel={() => navigate(visitsPath())}
          onSuccess={(visit) => navigate(`/emergency/visits/${visit.id}`)}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}
