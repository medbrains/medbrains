// OPD PrescriptionsTab — split from opd.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  CreatePrescriptionRequest,
  PendingSignoffEntry,
  PrescriptionWithItems,
  UpdatePrescriptionRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconSignature } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PrescriptionPrint, PrescriptionViews, useClinicalEmit } from "@/components";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { Badge, Button, toast } from "@/components/ui";
import { RxSuiteWriter } from "@/features/prescription/RxSuiteWriter";
import { opdService } from "@/services/opd.service";

export function PrescriptionsTab({
  encounterId,
  patientId,
  patientName,
  uhid,
  canUpdate,
  allergies = [],
}: {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  canUpdate: boolean;
  allergies?: string[];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canSign = useHasPermission(P.DOCTOR.SIGNATURE.SIGN);
  const [printRx, setPrintRx] = useState<PrescriptionWithItems | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<PendingSignoffEntry | null>(null);

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => opdService.listPrescriptions(encounterId),
  });

  const unsignedRx = (prescriptions as PrescriptionWithItems[]).filter(
    (p) => !(p.prescription as { is_signed?: boolean }).is_signed,
  );
  const signEntry = (rx: PrescriptionWithItems): PendingSignoffEntry => ({
    record_type: "prescription",
    record_id: rx.prescription.id,
    created_at: rx.prescription.created_at,
    legal_class: "clinical",
    patient_id: patientId,
    patient_name: patientName,
    uhid,
    summary: `${rx.items.length} medication${rx.items.length === 1 ? "" : "s"}`,
  });

  // hospital_name / address / phone feed the printed prescription's
  // letterhead. The tenant-settings read is served under admin.settings.read,
  // which a prescriber need not hold — refused, `hospitalSettings` is empty,
  // getSetting returns undefined for all three, and the prescription prints
  // with no institutional identification on it. Whether that should block
  // printing outright is a product call; this at least stops the fetch from
  // being made by someone the server will refuse.
  const canReadSettings = useHasAnyPermission([
    P.ADMIN.SETTINGS_READ,
    P.ADMIN.SETTINGS_GENERAL_MANAGE,
  ]);
  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => opdService.getTenantSettings("general"),
    enabled: canReadSettings,
    staleTime: 600_000,
  });

  const getSetting = (key: string) => {
    const row = hospitalSettings.find((s) => s.key === key);
    return row ? String(row.value) : undefined;
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePrescriptionRequest) =>
      opdService.createPrescription(encounterId, data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("order.created", {
        encounter_id: result.prescription.encounter_id,
        item_count: variables.items.length,
        items: result.items.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          drug_name: item.drug_name,
          item_id: item.id,
        })),
        order_id: result.prescription.id,
        order_type: "prescription",
        patient_id: patientId,
        prescription_id: result.prescription.id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Prescription blocked" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      data,
    }: {
      prescriptionId: string;
      data: UpdatePrescriptionRequest;
    }) => opdService.updatePrescription(prescriptionId, data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("opd.prescription.updated", {
        encounter_id: result.prescription.encounter_id,
        item_count: variables.data.items.length,
        patient_id: patientId,
        prescription_id: variables.prescriptionId,
        source_record_id: variables.prescriptionId,
      });
      toast.success("Pharmacy review and billing will use the revised prescription", {
        title: "Prescription updated",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Prescription blocked" }),
  });

  return (
    <>
      <RxSuiteWriter
        encounterId={encounterId}
        patientId={patientId}
        prescriptions={prescriptions as PrescriptionWithItems[]}
        canUpdate={canUpdate}
        onSave={(data) => createMutation.mutate(data)}
        onUpdate={(prescriptionId, data) => updateMutation.mutate({ prescriptionId, data })}
        isSaving={createMutation.isPending}
        isUpdating={updateMutation.isPending}
        onPrint={(rx) => setPrintRx(rx)}
        patientName={patientName}
        uhid={uhid}
        allergies={allergies}
      />
      {/* Pending doctor signature — sign right here (incl. nurse-drafted Rx) */}
      {canSign && unsignedRx.length > 0 && (
        <Card withBorder padding="sm" radius="md" mt="sm">
          <Group justify="space-between" mb={6}>
            <Group gap={6}>
              <IconSignature size={15} />
              <Text size="sm" fw={700}>
                Awaiting your signature
              </Text>
            </Group>
            <Badge tone="warning">{unsignedRx.length}</Badge>
          </Group>
          <Stack gap={6}>
            {unsignedRx.map((rx) => (
              <Group key={rx.prescription.id} justify="space-between">
                <Text size="xs" c="dimmed">
                  {rx.items.length} item{rx.items.length === 1 ? "" : "s"} ·{" "}
                  {new Date(rx.prescription.created_at).toLocaleString()}
                </Text>
                <Button
                  tone="primary"
                  size="xs"
                  leftSection={<IconSignature size={14} />}
                  onClick={() => setSignTarget(signEntry(rx))}
                >
                  Sign
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
      {signTarget && (
        <SignWorkspace
          opened={Boolean(signTarget)}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={() => {
            setSignTarget(null);
            void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
          }}
        />
      )}
      {/* 4-view prescription display — on demand (Prose, Timeline, Dose Calc, Rules) */}
      {(prescriptions as PrescriptionWithItems[]).length > 0 && (
        <Stack gap="xs" mt="sm">
          <Button
            tone="ghost"
            size="xs"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setViewsOpen((o) => !o)}
          >
            {viewsOpen ? "Hide" : "Show"} schedule · dose calc · rules
          </Button>
          {viewsOpen && (
            <PrescriptionViews
              prescriptions={prescriptions as PrescriptionWithItems[]}
              patientName={patientName}
              uhid={uhid}
              allergies={allergies}
            />
          )}
        </Stack>
      )}
      {printRx && (
        <PrescriptionPrint
          opened={Boolean(printRx)}
          onClose={() => setPrintRx(null)}
          prescription={printRx}
          patientName={patientName}
          uhid={uhid}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Admit to IPD Modal
// ══════════════════════════════════════════════════════════
