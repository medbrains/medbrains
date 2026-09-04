// Consent VerificationTab — split from consent.tsx (pure move).

import { Group, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { ConsentSummaryItem } from "@medbrains/types";
import { IconSearch, IconShieldCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { usePatientScope } from "@/hooks/usePatientScope";
import { consentService } from "@/services/consent.service";

const STATUS_COLORS: Record<string, BadgeTone> = {
  granted: "success",
  signed: "success",
  pending: "warning",
  denied: "danger",
  refused: "danger",
  withdrawn: "warning",
  expired: "neutral",
  missing: "danger",
};

export function VerificationTab({ canRevoke }: { canRevoke: boolean }) {
  const qc = useQueryClient();
  // Opened from a patient's chart, this arrives with the patient already
  // named — so it searches on arrival rather than asking a clinician to
  // retype the UUID of the patient they just came from. Reached from the
  // navigation it starts empty, as before. Seeded once on mount: the field
  // stays editable, so it cannot be driven from the URL afterwards.
  const { patientId: scopedPatientId, isScoped } = usePatientScope();
  const [patientId, setPatientId] = useState(scopedPatientId);
  const [searched, setSearched] = useState(isScoped);

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["consent-summary", patientId],
    queryFn: () => consentService.getPatientConsentSummary(patientId),
    enabled: !!patientId && searched,
  });

  const revokeMut = useMutation({
    mutationFn: (item: ConsentSummaryItem) =>
      consentService.revokeConsent({
        consent_source: item.source,
        consent_id: item.consent_id,
        patient_id: patientId,
        reason: "Revoked via consent management UI",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-summary"] });
      notifications.show({
        title: "Revoked",
        message: "Consent has been revoked",
        color: "orange",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not revoke consent", message: e.message, color: "red" }),
  });
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;

  const columns: Column<ConsentSummaryItem>[] = [
    {
      key: "consent_type",
      label: "Type",
      render: (r) => <Text size="sm">{r.consent_type.replace(/_/g, " ")}</Text>,
    },
    {
      key: "source",
      label: "Source",
      render: (r) => (
        <Badge tone={r.source === "patient_consent" ? "primary" : "accent"} size="sm">
          {r.source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={STATUS_COLORS[r.status] ?? "neutral"} size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r) => <Text size="sm">{r.valid_until ?? "No expiry"}</Text>,
    },
    {
      key: "consent_id",
      label: "Consent ID",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.consent_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canRevoke) return null;
        if (
          r.status === "withdrawn" ||
          r.status === "expired" ||
          r.status === "denied" ||
          r.status === "refused"
        ) {
          return null;
        }
        return (
          <IconButton
            size="sm"
            onClick={() => revokeMut.mutate(r)}
            loading={revokeMut.isPending}
            aria-label="Close"
          >
            <IconX size={14} />
          </IconButton>
        );
      },
    },
  ];

  return (
    <>
      <Group mb="md">
        <TextInput
          placeholder="Enter Patient ID (UUID)"
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setSearched(false);
          }}
          w={380}
          leftSection={<IconSearch size={14} />}
        />
        <Button
          tone="primary"
          leftSection={<IconShieldCheck size={16} />}
          onClick={() => setSearched(true)}
          disabled={!patientId}
        >
          Check Consents
        </Button>
      </Group>
      <PatientContextBanner patientId={contextPatientId} hideLoadingState />
      {searched && (
        <DataTable
          columns={columns}
          data={summary}
          loading={isLoading}
          rowKey={(r) => `${r.source}-${r.consent_id}`}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Signatures
// ══════════════════════════════════════════════════════════
