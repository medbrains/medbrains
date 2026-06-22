import { Box, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import {
  type CreatePrescriptionRequest,
  P,
  type PrescriptionTemplate,
  type PrescriptionWithItems,
  type RxOrderMode,
  type UpdatePrescriptionRequest,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Card, Checkbox, SegmentedControl } from "@/components/ui";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { matchDrugAllergy } from "@/utils/allergyMatch";
import classes from "./prescription.module.scss";
import { RxDoctor, type RxSafety } from "./RxDoctor";
import { RxPrint } from "./RxPrint";
import { catalogToFormulary, prescriptionItemsToRx, rxItemsToInput } from "./rxAdapter";
import { type FormularyDrug, maxDoseExceeded, type RxItem } from "./rxModel";
import { type SafetyIssue, SafetyOverrideModal } from "./SafetyOverrideModal";

interface Props {
  encounterId: string;
  patientId?: string;
  prescriptions: PrescriptionWithItems[];
  canUpdate: boolean;
  onSave: (data: CreatePrescriptionRequest) => void;
  /** Reserved for editing a saved Rx (not wired in the writer; sign/edit live in the sign-off queue). */
  onUpdate?: (prescriptionId: string, data: UpdatePrescriptionRequest) => void;
  isSaving?: boolean;
  isUpdating?: boolean;
  onPrint?: (rx: PrescriptionWithItems) => void;
  patientName: string;
  uhid: string;
  allergies?: string[];
  /** "nurse" → nurse-draft mode (Rx-only items route to MD). */
  prescriber?: "doctor" | "nurse";
}

const EMPTY_SAFETY: RxSafety = {
  interactions: [],
  allergy_conflicts: [],
  weight_alerts: [],
  renal_alerts: [],
  hepatic_alerts: [],
  ingredient_alerts: [],
};

/**
 * Embeddable, backend-wired prescription writer — the rx-suite composer + live
 * safety rail, mapped onto the existing `createPrescription` contract via
 * `rxAdapter`. Pure composer: history + signing live in the OPD views and the
 * doctor sign-off queue, not inline here. Scoped under `.suite`.
 */
export function RxSuiteWriter({
  encounterId,
  prescriptions,
  canUpdate,
  onSave,
  isSaving,
  patientId,
  patientName,
  uhid,
  allergies = [],
  prescriber = "doctor",
}: Props) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  // Print is permission-gated (doctors/admin), not tied to the nurse/doctor toggle.
  const canPrint = useHasPermission(P.OPD.VISIT_UPDATE);
  const [safety, setSafety] = useState<RxSafety>(EMPTY_SAFETY);
  const [currentItems, setCurrentItems] = useState<RxItem[]>([]);
  const [printOpen, printDisc] = useDisclosure(false);
  const [orderMode, setOrderMode] = useState<RxOrderMode>("written");
  const [orderingDoctorId, setOrderingDoctorId] = useState("");
  const [readBack, setReadBack] = useState(false);
  const [pendingItems, setPendingItems] = useState<RxItem[] | null>(null);
  const [overrideIssues, setOverrideIssues] = useState<SafetyIssue[]>([]);
  const isVerbal = prescriber === "nurse" && orderMode !== "written";

  const { data: catalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => clinicalSupportService.listPharmacyCatalog(),
    staleTime: 300_000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["prescription-templates"],
    queryFn: () => clinicalSupportService.listPrescriptionTemplates(),
    enabled: canUpdate,
    staleTime: 300_000,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data: { name: string; items: RxItem[] }) =>
      clinicalSupportService.createPrescriptionTemplate({
        name: data.name,
        is_shared: false,
        items: rxItemsToInput(data.items),
      }),
    onSuccess: (_r, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["prescription-templates"] });
      notifications.show({
        title: "Saved order set",
        message: `"${vars.name}" saved`,
        color: "success",
      });
    },
  });

  const formulary = useMemo<FormularyDrug[]>(() => catalogToFormulary(catalog), [catalog]);
  const formularyById = useMemo(
    () => Object.fromEntries(formulary.map((d) => [d.id, d])),
    [formulary],
  );

  const templateToItems = (tpl: PrescriptionTemplate): RxItem[] =>
    prescriptionItemsToRx(tpl.items, formularyById);

  // Catalog ids already prescribed on this visit → warn (don't block) on re-add.
  const priorDrugIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of prescriptions) {
      for (const it of p.items) if (it.catalog_item_id) ids.add(it.catalog_item_id);
    }
    return [...ids];
  }, [prescriptions]);

  const runSafety = async (items: RxItem[]) => {
    if (items.length === 0) {
      setSafety(EMPTY_SAFETY);
      return;
    }
    try {
      setSafety(
        await clinicalSupportService.checkDrugSafety({
          drug_names: items.map((i) => i.name),
          patient_id: patientId,
          items: rxItemsToInput(items).map((i) => ({
            drug_name: i.drug_name,
            dosage: i.dosage,
            frequency: i.frequency,
            catalog_item_id: i.catalog_item_id,
          })),
        }),
      );
    } catch {
      /* never block prescribing on a safety-service hiccup */
    }
  };

  const handleItemsChange = (items: RxItem[]) => {
    setCurrentItems(items);
    void runSafety(items);
  };

  const doSave = (items: RxItem[], overrides?: { dose?: string; allergy?: string }) => {
    onSave({
      items: rxItemsToInput(items),
      ...(overrides?.dose ? { dose_override_reason: overrides.dose } : {}),
      ...(overrides?.allergy ? { allergy_override_reason: overrides.allergy } : {}),
      ...(isVerbal
        ? {
            order_mode: orderMode,
            ordering_doctor_id: orderingDoctorId,
            read_back_confirmed: readBack,
          }
        : {}),
    });
    setSafety(EMPTY_SAFETY);
    setReadBack(false);
  };

  // Safety guards checked at save: a documented drug allergy (sentinel event)
  // and a daily dose over the catalogue max. Both warn-and-acknowledge; the
  // server re-checks each independently as a backstop.
  const safetyIssues = (items: RxItem[]): SafetyIssue[] => {
    const issues: SafetyIssue[] = [];
    for (const it of items) {
      const conflict = allergies
        .map((a) => ({ allergen: a, hit: matchDrugAllergy(it.name, a) }))
        .find((c) => c.hit !== null);
      if (conflict) {
        issues.push({
          kind: "allergy",
          name: it.name,
          detail: `Documented allergy: ${conflict.allergen}${conflict.hit?.cross ? ` (cross-reactive ${conflict.hit.class})` : ""}`,
        });
      }
      const drug = formularyById[it.id];
      const hit = drug ? maxDoseExceeded(it, drug) : null;
      if (hit) issues.push({ kind: "dose", name: it.name, detail: hit.totalLabel });
    }
    return issues;
  };

  const handleSave = (items: RxItem[]) => {
    if (!canUpdate || items.length === 0) return;
    if (isVerbal && (!orderingDoctorId || !readBack)) {
      notifications.show({
        title: "Verbal order incomplete",
        message: "Select the ordering doctor and confirm read-back before saving.",
        color: "warning",
      });
      return;
    }
    const issues = safetyIssues(items);
    if (issues.length > 0) {
      setPendingItems(items);
      setOverrideIssues(issues);
      return;
    }
    doSave(items);
  };

  const confirmOverride = (reason: string) => {
    if (pendingItems) {
      doSave(pendingItems, {
        dose: overrideIssues.some((i) => i.kind === "dose") ? reason : undefined,
        allergy: overrideIssues.some((i) => i.kind === "allergy") ? reason : undefined,
      });
    }
    setPendingItems(null);
    setOverrideIssues([]);
  };

  const signer = {
    name: user?.full_name ?? "Prescriber",
    reg: user?.role ? `${user.role.replace(/_/g, " ")}` : "",
    nurseName: user?.full_name ?? "Nurse",
    nurseReg: "Nursing",
  };

  return (
    <Box className={classes.suite}>
      {prescriber === "nurse" && (
        <Card padding="sm" mb="sm">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Order type
            </Text>
            <SegmentedControl
              value={orderMode}
              onChange={(v) => setOrderMode(v as RxOrderMode)}
              data={[
                { label: "Written", value: "written" },
                { label: "Verbal", value: "verbal" },
                { label: "Telephone", value: "telephone" },
              ]}
            />
            {isVerbal && (
              <>
                <DoctorSearchSelect
                  label="Ordering doctor"
                  value={orderingDoctorId}
                  onChange={setOrderingDoctorId}
                  required
                />
                <Checkbox
                  label="I read the order back to the doctor and they confirmed it"
                  checked={readBack}
                  onChange={(e) => setReadBack(e.currentTarget.checked)}
                />
                <Text size="xs" c="dimmed">
                  The order is recorded under the doctor and routed to them to countersign within 24
                  hours.
                </Text>
              </>
            )}
          </Stack>
        </Card>
      )}
      <RxDoctor
        formulary={formulary}
        formularyById={formularyById}
        initialItems={[]}
        patientName={patientName}
        patientAllergies={allergies}
        prescriber={prescriber}
        canSave={canUpdate}
        saving={Boolean(isSaving)}
        editing={false}
        safety={safety}
        signer={signer}
        templates={templates}
        templateToItems={templateToItems}
        onSaveTemplate={(name, items) => saveTemplateMutation.mutate({ name, items })}
        priorDrugIds={priorDrugIds}
        onItemsChange={handleItemsChange}
        onPrint={canPrint ? printDisc.open : undefined}
        onSave={handleSave}
      />
      <RxPrint
        opened={printOpen}
        onClose={printDisc.close}
        encounterId={encounterId}
        items={currentItems}
        formularyById={formularyById}
        patientName={patientName}
        uhid={uhid}
      />
      <SafetyOverrideModal
        opened={pendingItems !== null}
        issues={overrideIssues}
        saving={Boolean(isSaving)}
        onConfirm={confirmOverride}
        onClose={() => {
          setPendingItems(null);
          setOverrideIssues([]);
        }}
      />
    </Box>
  );
}
