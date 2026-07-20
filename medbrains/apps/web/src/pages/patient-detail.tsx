import { ClinicalEventProvider } from "@/components/ClinicalEventProvider";
import { PatientDetailPageInner } from "./patient-detail/page-inner";

export function PatientDetailPage() {
  return (
    <ClinicalEventProvider moduleCode="patients" contextCode="patient-detail">
      <PatientDetailPageInner />
    </ClinicalEventProvider>
  );
}
