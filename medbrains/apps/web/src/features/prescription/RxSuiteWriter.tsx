import { Box, Group, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type {
  CreatePrescriptionRequest,
  PrescriptionWithItems,
  UpdatePrescriptionRequest,
} from "@medbrains/types";
import { IconPencil, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import classes from "./prescription.module.scss";
import { RxDoctor, type RxSafety } from "./RxDoctor";
import { catalogToFormulary, prescriptionItemsToRx, rxItemsToInput } from "./rxAdapter";
import type { FormularyDrug, RxItem } from "./rxModel";

interface Props {
  encounterId: string;
  patientId?: string;
  prescriptions: PrescriptionWithItems[];
  canUpdate: boolean;
  onSave: (data: CreatePrescriptionRequest) => void;
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

const EMPTY_SAFETY: RxSafety = { interactions: [], allergy_conflicts: [] };

function isEditable(rx: PrescriptionWithItems): boolean {
  return (
    !rx.pharmacy_order_id &&
    (!rx.pharmacy_status || ["pending_review", "on_hold", "rejected"].includes(rx.pharmacy_status))
  );
}

/**
 * Embeddable, backend-wired prescription writer — the rx-suite composer + live
 * safety rail, mapped onto the existing `createPrescription`/`updatePrescription`
 * contract via `rxAdapter`. Drop-in replacement for the legacy
 * `PrescriptionWriter` (same props) plus patient info; scoped under `.suite`.
 */
export function RxSuiteWriter({
  prescriptions,
  canUpdate,
  onSave,
  onUpdate,
  isSaving,
  isUpdating,
  onPrint,
  patientId,
  patientName,
  allergies = [],
  prescriber = "doctor",
}: Props) {
  const user = useAuthStore((s) => s.user);
  const [editingRx, setEditingRx] = useState<PrescriptionWithItems | null>(null);
  const [safety, setSafety] = useState<RxSafety>(EMPTY_SAFETY);

  const { data: catalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => clinicalSupportService.listPharmacyCatalog(),
    staleTime: 300_000,
  });

  const formulary = useMemo<FormularyDrug[]>(() => catalogToFormulary(catalog), [catalog]);
  const formularyById = useMemo(
    () => Object.fromEntries(formulary.map((d) => [d.id, d])),
    [formulary],
  );

  const initialItems = useMemo(
    () => (editingRx ? prescriptionItemsToRx(editingRx.items, formularyById) : []),
    [editingRx, formularyById],
  );

  const runSafety = async (drugNames: string[]) => {
    if (drugNames.length === 0) {
      setSafety(EMPTY_SAFETY);
      return;
    }
    try {
      setSafety(
        await clinicalSupportService.checkDrugSafety({
          drug_names: drugNames,
          patient_id: patientId,
        }),
      );
    } catch {
      /* never block prescribing on a safety-service hiccup */
    }
  };

  const handleItemsChange = (items: { name: string }[]) => {
    void runSafety(items.map((i) => i.name));
  };

  const handleSave = (items: RxItem[]) => {
    if (!canUpdate || items.length === 0) return;
    const data = { items: rxItemsToInput(items) };
    if (editingRx && onUpdate) onUpdate(editingRx.prescription.id, data);
    else onSave(data);
    setEditingRx(null);
    setSafety(EMPTY_SAFETY);
  };

  const startEdit = (rx: PrescriptionWithItems) => {
    setEditingRx(rx);
    void runSafety(rx.items.map((i) => i.drug_name));
  };

  const signer = {
    name: user?.full_name ?? "Prescriber",
    reg: user?.role ? `${user.role.replace(/_/g, " ")}` : "",
    nurseName: user?.full_name ?? "Nurse",
    nurseReg: "Nursing",
  };

  return (
    <Box className={classes.suite}>
      <RxDoctor
        key={editingRx?.prescription.id ?? "new"}
        formulary={formulary}
        formularyById={formularyById}
        initialItems={initialItems}
        patientName={patientName}
        patientAllergies={allergies}
        prescriber={prescriber}
        canSave={canUpdate}
        saving={Boolean(editingRx ? isUpdating : isSaving)}
        editing={Boolean(editingRx)}
        safety={safety}
        signer={signer}
        onItemsChange={handleItemsChange}
        onSave={handleSave}
      />

      {prescriptions.length > 0 && (
        <Box className={classes.existingList}>
          {prescriptions.map((rx) => {
            const editable = canUpdate && isEditable(rx);
            return (
              <Card key={rx.prescription.id} className={classes.existingCard}>
                <Group justify="space-between" gap="sm">
                  <Group gap="sm">
                    <Text size="sm" fw={600}>
                      {rx.items.length} item{rx.items.length === 1 ? "" : "s"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(rx.prescription.created_at).toLocaleString()}
                    </Text>
                    {rx.pharmacy_status && (
                      <Text size="xs" c="dimmed">
                        · {rx.pharmacy_status.replace(/_/g, " ")}
                      </Text>
                    )}
                  </Group>
                  <Group gap={4}>
                    {editable && onUpdate && (
                      <IconButton
                        aria-label="Edit prescription"
                        onClick={() => startEdit(rx)}
                        size="sm"
                      >
                        <IconPencil size={15} stroke={1.6} />
                      </IconButton>
                    )}
                    {onPrint && (
                      <IconButton
                        aria-label="Print prescription"
                        onClick={() => onPrint(rx)}
                        size="sm"
                      >
                        <IconPrinter size={15} stroke={1.6} />
                      </IconButton>
                    )}
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
