// Ipd DischargeTab — split from ipd.tsx (pure move).

import { Checkbox, Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DischargeType, IpdDischargeChecklist } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDoor } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useClinicalEmit } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

const DISCHARGE_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "lama", label: "LAMA" },
  { value: "dama", label: "DAMA" },
  { value: "absconded", label: "Absconded" },
  { value: "referred", label: "Referred" },
  { value: "deceased", label: "Deceased" },
] satisfies { value: DischargeType; label: string }[];

function normalizeDischargeType(value: string | null): DischargeType {
  return DISCHARGE_TYPE_OPTIONS.find((option) => option.value === value)?.value ?? "normal";
}

export function DischargeTab({
  admissionId,
  canDischarge,
  patientId,
  status,
}: {
  admissionId: string;
  canDischarge: boolean;
  patientId: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const [dischargeType, setDischargeType] = useState<DischargeType>("normal");
  const [summary, setSummary] = useState("");
  const emit = useClinicalEmit();

  // The tab rides in on ipd.admissions.view; the discharge checklist carries its own
  // code. Refused, `data ?? []` renders an empty table that reads as a
  // fact about the patient rather than about the reader.
  const canViewChecklist = useHasPermission(P.IPD.DISCHARGE_CHECKLIST_LIST);
  const { data: checklist } = useQuery({
    queryKey: ["ipd-discharge-checklist", admissionId],
    queryFn: () => ipdService.listDischargeChecklist(admissionId),
    enabled: canViewChecklist,
  });

  const dischargeMutation = useMutation({
    mutationFn: () =>
      ipdService.dischargePatient(admissionId, {
        discharge_type: dischargeType,
        discharge_summary: summary || undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Patient discharged", { title: "Discharged" });
      emit("ipd.discharge.completed", {
        admission_id: admissionId,
        discharge_type: result.discharge_type ?? dischargeType,
        patient_id: result.patient_id ?? patientId,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Discharge blocked" }),
  });

  if (status === "discharged" || status === "absconded" || status === "deceased") {
    return (
      <Text c="dimmed" size="sm">
        This patient has already been discharged.
      </Text>
    );
  }

  const items = (checklist ?? []) as IpdDischargeChecklist[];

  return (
    <Stack>
      {items.length > 0 && (
        <>
          <Text fw={600} size="sm">
            Discharge Checklist
          </Text>
          {items.map((it) => (
            <Group key={it.id} gap="xs">
              <Checkbox checked={it.status === "completed"} readOnly size="xs" />
              <Text size="sm">{it.item_label}</Text>
              <Badge
                size="xs"
                tone={
                  it.status === "completed"
                    ? "success"
                    : it.status === "not_applicable"
                      ? "neutral"
                      : "warning"
                }
              >
                {it.status}
              </Badge>
            </Group>
          ))}
        </>
      )}

      {canDischarge ? (
        <>
          <Select
            label="Discharge Type"
            data={DISCHARGE_TYPE_OPTIONS}
            value={dischargeType}
            onChange={(v) => setDischargeType(normalizeDischargeType(v))}
          />
          <Textarea
            label="Discharge Summary"
            value={summary}
            onChange={(e) => setSummary(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Button
            tone="danger"
            leftSection={<IconDoor size={16} />}
            onClick={() => dischargeMutation.mutate()}
            loading={dischargeMutation.isPending}
          >
            Discharge Patient
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">
          You do not have permission to discharge patients.
        </Text>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Wards Tab ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
