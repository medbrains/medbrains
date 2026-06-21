import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import {
  type CreatePrescriptionRequest,
  P,
  type PendingSignoffEntry,
  type PrescriptionTemplate,
  type PrescriptionWithItems,
  type UpdatePrescriptionRequest,
} from "@medbrains/types";
import {
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconPrinter,
  IconSignature,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { Badge, Button, Card } from "@/components/ui";
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
  uhid,
  allergies = [],
  prescriber = "doctor",
}: Props) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canSign = useHasPermission(P.DOCTOR.SIGNATURE.SIGN);
  const [editingRx, setEditingRx] = useState<PrescriptionWithItems | null>(null);
  const [safety, setSafety] = useState<RxSafety>(EMPTY_SAFETY);
  const [signTarget, setSignTarget] = useState<PendingSignoffEntry | null>(null);
  const [prevOpen, prevPanel] = useDisclosure(false);

  const signEntry = (rx: PrescriptionWithItems): PendingSignoffEntry => ({
    record_type: "prescription",
    record_id: rx.prescription.id,
    created_at: rx.prescription.created_at,
    legal_class: "clinical",
    patient_id: patientId ?? null,
    patient_name: patientName,
    uhid,
    summary: `${rx.items.length} medication${rx.items.length === 1 ? "" : "s"}`,
  });
  const afterSign = () => {
    setSignTarget(null);
    void queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    void queryClient.invalidateQueries({ queryKey: ["encounter-prescriptions"] });
  };
  const isSigned = (rx: PrescriptionWithItems) =>
    Boolean((rx.prescription as { is_signed?: boolean }).is_signed);

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

  // catalog ids already prescribed on this visit (excluding the one being edited)
  const priorDrugIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of prescriptions) {
      if (editingRx && p.prescription.id === editingRx.prescription.id) continue;
      for (const it of p.items) if (it.catalog_item_id) ids.add(it.catalog_item_id);
    }
    return [...ids];
  }, [prescriptions, editingRx]);

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
        templates={templates}
        templateToItems={templateToItems}
        onSaveTemplate={(name, items) => saveTemplateMutation.mutate({ name, items })}
        priorDrugIds={priorDrugIds}
        signAction={
          editingRx && canSign && !isSigned(editingRx) ? (
            <Button
              tone="secondary"
              leftSection={<IconSignature size={15} />}
              onClick={() => setSignTarget(signEntry(editingRx))}
            >
              Sign digitally
            </Button>
          ) : editingRx && isSigned(editingRx) ? (
            <Badge tone="success">Signed</Badge>
          ) : undefined
        }
        onItemsChange={handleItemsChange}
        onSave={handleSave}
      />

      {prescriptions.length > 0 && (
        <Box className={classes.prevWrap}>
          <UnstyledButton
            className={classes.prevToggle}
            onClick={prevPanel.toggle}
            aria-expanded={prevOpen}
          >
            {prevOpen ? (
              <IconChevronUp size={14} stroke={1.8} />
            ) : (
              <IconChevronDown size={14} stroke={1.8} />
            )}
            <span>
              {prescriptions.length} prescription{prescriptions.length === 1 ? "" : "s"} on this
              visit
            </span>
          </UnstyledButton>
          {prevOpen && (
            <Box className={classes.existingList}>
              {prescriptions.map((rx) => {
                const editable = canUpdate && isEditable(rx);
                const signed = isSigned(rx);
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
                        {signed && <Badge tone="success">Signed</Badge>}
                        {rx.pharmacy_status && (
                          <Text size="xs" c="dimmed">
                            · {rx.pharmacy_status.replace(/_/g, " ")}
                          </Text>
                        )}
                      </Group>
                      <Group gap={4}>
                        {canSign && !signed && (
                          <IconButton
                            aria-label="Sign prescription digitally"
                            tone="primary"
                            onClick={() => setSignTarget(signEntry(rx))}
                            size="sm"
                          >
                            <IconSignature size={15} stroke={1.6} />
                          </IconButton>
                        )}
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
      )}

      {signTarget && (
        <SignWorkspace
          opened={Boolean(signTarget)}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={afterSign}
        />
      )}
    </Box>
  );
}
