// The components behind brick panels (`Panel` in crates/medbrains-core/src/bricks.rs). A host
// screen names a slot, never a panel's module: each panel is its own chunk, downloaded only when
// `usePanels` lets it through.

import { type ComponentType, lazy } from "react";

/** What a `patient.tabs` panel is handed: it is the body of a patient record tab. */
export interface PatientTabPanelProps {
  patientId: string;
}

/** What an `opd.encounter` panel is handed: a modal the encounter opens from its flow chip. */
export interface EncounterPanelProps {
  patientId: string;
  encounterId: string;
  opened: boolean;
  onClose: () => void;
}

/** Each slot's props, so a panel cannot be plugged into a slot it was not written for. */
export interface SlotProps {
  "patient.tabs": PatientTabPanelProps;
  "opd.encounter": EncounterPanelProps;
}

export type PanelSlot = keyof SlotProps;

/** Each slot's panels by manifest id. `panel-registry.test.ts` holds it to the manifest. */
export const PANEL_COMPONENTS: {
  [S in PanelSlot]: Record<string, ComponentType<SlotProps[S]>>;
} = {
  "patient.tabs": {
    "lab.patient_orders": lazy(() =>
      import("@/pages/patient-detail/lab-orders-tab").then((m) => ({ default: m.LabOrdersTab })),
    ),
    "radiology.patient_imaging": lazy(() =>
      import("@/pages/patient-detail/imaging-tab").then((m) => ({ default: m.ImagingTab })),
    ),
    "billing.patient_bills": lazy(() =>
      import("@/pages/patient-detail/billing-tab").then((m) => ({ default: m.BillingTab })),
    ),
  },
  "opd.encounter": {
    "billing.encounter_bill": lazy(() =>
      import("@/components/Billing/PatientBillingModal").then((m) => ({
        default: m.PatientBillingModal,
      })),
    ),
    "emergency.er_visit": lazy(() =>
      import("@/components/Emergency/EmergencyVisitModal").then((m) => ({
        default: m.EmergencyVisitModal,
      })),
    ),
  },
};
