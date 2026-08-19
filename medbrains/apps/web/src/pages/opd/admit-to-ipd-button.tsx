// OPD AdmitToIpdButton — split from opd.tsx (pure move).

import { Group, Menu, Modal, Select, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasAnyPermission } from "@medbrains/stores";
import type { AdmitFromOpdRequest, DepartmentRow } from "@medbrains/types";
import { IconMedicalCross } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useClinicalEmit } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { Button, toast } from "@/components/ui";
import { DEPARTMENT_LIST_CODES, WARD_LIST_CODES } from "@/lib/api-permission-sets";
import { opdService } from "@/services/opd.service";

export function AdmitToIpdButton({
  encounterId,
  patientName,
  asMenuItem = false,
  control,
}: {
  encounterId: string;
  patientName: string;
  asMenuItem?: boolean;
  control?: ReturnType<typeof useDisclosure>;
}) {
  const { t } = useTranslation("opd");
  const internalDisclosure = useDisclosure(false);
  const [opened, { open, close }] = control ?? internalDisclosure;
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const emit = useClinicalEmit();

  // The department picker is the shared setup endpoint, which takes
  // require_any_permission over nineteen codes. Mirror the handler rather than
  // guess one member — gating on one would hide the picker from people the
  // server would allow.
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  // The ward list has its own six-code set for the same reason.
  const canListWards = useHasAnyPermission(WARD_LIST_CODES);
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    enabled: canListDepartments,
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: () => opdService.listWards(),
    enabled: opened && canListWards,
  });

  const deptOptions = departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }));
  const wardOptions = (wards as Array<{ id: string; name: string }>).map((w) => ({
    value: w.id,
    label: w.name,
  }));

  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromOpdRequest) => opdService.admitFromOpd(encounterId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      emit("ipd.admission.created", {
        admission_id: result.admission.id,
        patient_id: result.admission.patient_id,
        opd_encounter_id: encounterId,
        encounter_id: result.admission.encounter_id,
        department_id: result.ipd_encounter.department_id,
        ward_id: result.admission.ward_id,
        bed_id: result.admission.bed_id,
        source_record_id: result.admission.id,
      });
      if (result.admission.bed_id) {
        emit("bed.assigned", {
          admission_id: result.admission.id,
          patient_id: result.admission.patient_id,
          opd_encounter_id: encounterId,
          encounter_id: result.admission.encounter_id,
          department_id: result.ipd_encounter.department_id,
          ward_id: result.admission.ward_id,
          bed_id: result.admission.bed_id,
          source_record_id: result.admission.id,
        });
      }
      toast.success(
        t("notify.patientAdmittedToIpdDetail", {
          diagnoses: result.diagnoses_copied,
          patient: patientName,
          prescriptions: result.prescriptions_copied,
          vitals: result.vitals_copied,
        }),
        { title: t("notify.patientAdmittedToIpd") },
      );
      close();
    },
    onError: () => {
      toast.error(t("notify.admissionFailed"), { title: t("notify.error") });
    },
  });

  const handleAdmit = () => {
    if (!deptId) return;
    admitMutation.mutate({
      department_id: deptId,
      ward_id: wardId ?? undefined,
      bed_id: bedId ?? undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <>
      {asMenuItem ? (
        <Menu.Item leftSection={<IconMedicalCross size={14} />} onClick={open}>
          {t("admission.admitToIpd")}
        </Menu.Item>
      ) : (
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconMedicalCross size={14} />}
          onClick={open}
        >
          {t("admission.admitToIpd")}
        </Button>
      )}
      <Modal
        opened={opened}
        onClose={close}
        title={t("admission.modalTitle", { patient: patientName })}
        size="md"
      >
        <Stack gap="sm">
          <Select
            label={t("label.department")}
            placeholder={t("placeholder.selectDepartment")}
            data={deptOptions}
            value={deptId}
            onChange={setDeptId}
            searchable
            required
          />
          <Select
            label={t("label.ward")}
            placeholder={t("placeholder.selectWard(optional)")}
            data={wardOptions}
            value={wardId}
            onChange={(val) => {
              setWardId(val);
              setBedId(null);
            }}
            searchable
            clearable
          />
          <BedSelect
            label={t("label.bed")}
            placeholder={t("placeholder.selectAvailableBed")}
            value={bedId ?? ""}
            onChange={(nextBedId) => setBedId(nextBedId || null)}
            clearable
            enabled={opened}
            wardId={wardId ?? undefined}
          />
          <Textarea
            label={t("label.notes")}
            placeholder={t("placeholder.admissionNotes")}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              tone="primary"
              onClick={handleAdmit}
              loading={admitMutation.isPending}
              disabled={!deptId}
            >
              {t("admission.admitPatient")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
