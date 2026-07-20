// Consent AuditTab — split from consent.tsx (pure move).

import { Code, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import type { ConsentAuditEntry } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, type BadgeTone, IconButton } from "@/components/ui";
import { consentService } from "@/services/consent.service";

const AUDIT_ACTION_COLORS: Record<string, BadgeTone> = {
  created: "neutral",
  granted: "success",
  signed: "success",
  denied: "danger",
  refused: "danger",
  withdrawn: "warning",
  revoked: "danger",
  expired: "warning",
  renewed: "primary",
  amended: "primary",
};

export function AuditTab() {
  const [patientId, setPatientId] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["consent-audit", patientId, actionFilter, sourceFilter],
    queryFn: () =>
      consentService.listConsentAudit({
        patient_id: patientId || undefined,
        action: actionFilter ?? undefined,
        consent_source: sourceFilter ?? undefined,
      }),
  });

  const [detailEntry, setDetailEntry] = useState<ConsentAuditEntry | null>(null);
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;

  const columns: Column<ConsentAuditEntry>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "consent_source",
      label: "Source",
      render: (r) => (
        <Badge tone={r.consent_source === "patient_consent" ? "primary" : "accent"} size="sm">
          {r.consent_source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <Badge tone={AUDIT_ACTION_COLORS[r.action] ?? "neutral"} size="sm">
          {r.action}
        </Badge>
      ),
    },
    {
      key: "status_change",
      label: "Status Change",
      render: (r) => (
        <Text size="sm">
          {r.old_status ?? "—"} → {r.new_status ?? "—"}
        </Text>
      ),
    },
    {
      key: "changed_by",
      label: "Changed By",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.changed_by?.slice(0, 8) ?? "—"}
        </Text>
      ),
    },
    {
      key: "change_reason",
      label: "Reason",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.change_reason ?? "—"}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Timestamp",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
    {
      key: "detail",
      label: "",
      render: (r) => (
        <IconButton size="sm" onClick={() => setDetailEntry(r)} aria-label="Search">
          <IconSearch size={14} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <Group mb="md">
        <TextInput
          placeholder="Patient ID"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          w={280}
          leftSection={<IconSearch size={14} />}
        />
        <Select
          placeholder="Action"
          data={[
            { value: "created", label: "Created" },
            { value: "granted", label: "Granted" },
            { value: "signed", label: "Signed" },
            { value: "denied", label: "Denied" },
            { value: "refused", label: "Refused" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "revoked", label: "Revoked" },
            { value: "expired", label: "Expired" },
            { value: "renewed", label: "Renewed" },
            { value: "amended", label: "Amended" },
          ]}
          value={actionFilter}
          onChange={setActionFilter}
          clearable
          w={180}
        />
        <Select
          placeholder="Source"
          data={[
            { value: "patient_consent", label: "Patient Consent" },
            { value: "procedure_consent", label: "Procedure Consent" },
          ]}
          value={sourceFilter}
          onChange={setSourceFilter}
          clearable
          w={200}
        />
      </Group>
      <PatientContextBanner patientId={contextPatientId} hideLoadingState />
      <DataTable columns={columns} data={entries} loading={isLoading} rowKey={(r) => r.id} />
      <Modal
        opened={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title="Audit Entry Detail"
        size="lg"
      >
        {detailEntry && (
          <Stack gap="xs">
            <Text size="sm">
              <strong>ID:</strong> {detailEntry.id}
            </Text>
            <Text size="sm">
              <strong>Patient:</strong> {detailEntry.patient_id}
            </Text>
            <Text size="sm">
              <strong>Consent ID:</strong> {detailEntry.consent_id}
            </Text>
            <Text size="sm">
              <strong>Source:</strong> {detailEntry.consent_source}
            </Text>
            <Text size="sm">
              <strong>Action:</strong> {detailEntry.action}
            </Text>
            <Text size="sm">
              <strong>Status:</strong> {detailEntry.old_status ?? "—"} →{" "}
              {detailEntry.new_status ?? "—"}
            </Text>
            <Text size="sm">
              <strong>Changed By:</strong> {detailEntry.changed_by ?? "—"}
            </Text>
            <Text size="sm">
              <strong>Reason:</strong> {detailEntry.change_reason ?? "—"}
            </Text>
            <Text size="sm">
              <strong>IP:</strong> {detailEntry.ip_address ?? "—"}
            </Text>
            <Text size="sm">
              <strong>User Agent:</strong> {detailEntry.user_agent ?? "—"}
            </Text>
            <Text size="sm">
              <strong>Timestamp:</strong> {new Date(detailEntry.created_at).toLocaleString()}
            </Text>
            <Text size="sm" fw={600}>
              Metadata:
            </Text>
            <Code block>{JSON.stringify(detailEntry.metadata, null, 2)}</Code>
          </Stack>
        )}
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Verification
// ══════════════════════════════════════════════════════════
