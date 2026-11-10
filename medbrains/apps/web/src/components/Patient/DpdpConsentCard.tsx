/**
 * What the patient agreed to under the DPDP Act, and the button to record
 * the notice (if registration could not) or a change of mind. Each change is
 * a new decision on the ledger; the history stays.
 */
import { Group, List, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DpdpConsentRecord, P, type Patient } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Modal, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { DpdpNoticePanel, type DpdpNoticeValue } from "./DpdpNoticePanel";
import { DPDP_NOTICE, DPDP_NOTICE_VERSION } from "./dpdp-notice";

interface DpdpConsentCardProps {
  patient: Patient;
}

function describeConsent(record: DpdpConsentRecord): string {
  const when = new Date(record.created_at).toLocaleDateString();
  const who = record.recorded_by_name ? ` by ${record.recorded_by_name}` : "";
  const by = record.guardian_name ? `, agreed by ${record.guardian_name}` : "";
  return `${when}${who}${by}`;
}

export function DpdpConsentCard({ patient }: DpdpConsentCardProps) {
  const canChange = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const queryKey = ["patient-dpdp-consent", patient.id];
  const consent = useQuery({
    queryKey,
    queryFn: () => patientDetailService.getPatientDpdpConsent(patient.id),
  });
  const current = consent.data?.history[0];
  const [editing, setEditing] = useState<DpdpNoticeValue | null>(null);
  const save = useMutation({
    mutationFn: (value: DpdpNoticeValue) =>
      patientDetailService.setPatientDpdpConsent(patient.id, {
        notice_version: DPDP_NOTICE_VERSION,
        notice_language: value.language,
        purposes: value.purposes,
        guardian_name: value.guardian.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setEditing(null);
      toast.success("Privacy consent recorded");
    },
  });
  const open = () =>
    setEditing({
      language: current?.notice_language ?? "en",
      purposes: current?.purposes ?? [],
      noticeGiven: false,
      guardian: current?.guardian_name ?? "",
    });

  return (
    <Card withBorder data-testid="dpdp-consent-card">
      <Group justify="space-between" mb="sm">
        <Title order={5}>Privacy consent (DPDP)</Title>
        {canChange && (
          <Button tone="secondary" size="compact-sm" onClick={open}>
            {current ? "Change" : "Record notice"}
          </Button>
        )}
      </Group>
      {consent.isError ? (
        <Alert tone="danger">Could not load what this patient agreed to.</Alert>
      ) : !current ? (
        <Text size="sm" c="dimmed">
          The privacy notice has not been recorded for this patient.
        </Text>
      ) : (
        <Stack gap="xs">
          {current.purposes.length === 0 ? (
            <Text size="sm">Notice given; no purposes beyond care agreed.</Text>
          ) : (
            <List size="sm">
              {current.purposes.map((p) => (
                <List.Item key={p}>{DPDP_NOTICE.en.purposes[p]}</List.Item>
              ))}
            </List>
          )}
          <Text size="xs" c="dimmed">
            {describeConsent(current)}
            {consent.data && consent.data.history.length > 1
              ? ` · ${consent.data.history.length - 1} earlier decision(s)`
              : ""}
          </Text>
        </Stack>
      )}
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title="Privacy notice"
        size="lg"
      >
        {editing && (
          <Stack gap="sm">
            <DpdpNoticePanel value={editing} onChange={setEditing} />
            {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
            <Button
              tone="primary"
              disabled={!editing.noticeGiven}
              loading={save.isPending}
              onClick={() => save.mutate(editing)}
            >
              Record consent
            </Button>
          </Stack>
        )}
      </Modal>
    </Card>
  );
}
