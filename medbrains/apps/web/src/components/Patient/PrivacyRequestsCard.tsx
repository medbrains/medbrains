/**
 * The patient's DPDP requests on their page: what they asked for and when it
 * is due, the form to record a new one, and — to answer an access request —
 * what the hospital holds about them.
 */
import { Group, List, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type Patient } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Modal, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { NewPrivacyRequestForm } from "./NewPrivacyRequestForm";
import { daysLeft, PRIVACY_TYPE_LABEL } from "./privacy-request-labels";

interface PrivacyRequestsCardProps {
  patient: Patient;
}

export function PrivacyRequestsCard({ patient }: PrivacyRequestsCardProps) {
  const canCreate = useHasPermission(P.PATIENTS.PRIVACY_REQUESTS_CREATE);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const queryKey = ["privacy-requests", patient.id];
  const requests = useQuery({
    queryKey,
    queryFn: () => patientDetailService.listPrivacyRequests({ patient_id: patient.id }),
  });
  const held = useQuery({
    queryKey: ["patient-data-summary", patient.id],
    queryFn: () => patientDetailService.getPatientDataSummary(patient.id),
    enabled: showHeld,
  });
  const create = useMutation({
    mutationFn: patientDetailService.createPrivacyRequest,
    onSuccess: () => {
      setAdding(false);
      void qc.invalidateQueries({ queryKey: ["privacy-requests"] });
      toast.success("Request recorded — due in 90 days");
    },
  });

  return (
    <Card withBorder data-testid="privacy-requests-card">
      <Group justify="space-between" mb="sm">
        <Title order={5}>Privacy requests (DPDP)</Title>
        <Group gap="xs">
          <Button tone="ghost" size="compact-sm" onClick={() => setShowHeld(true)}>
            What we hold
          </Button>
          {canCreate && (
            <Button tone="secondary" size="compact-sm" onClick={() => setAdding(true)}>
              New request
            </Button>
          )}
        </Group>
      </Group>
      {requests.isError ? (
        <Alert tone="danger">Could not load this patient's requests.</Alert>
      ) : (requests.data ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          No privacy requests.
        </Text>
      ) : (
        <Stack gap="xs">
          {(requests.data ?? []).map((r) => (
            <Group key={r.id} justify="space-between" wrap="nowrap">
              <Text size="sm">{PRIVACY_TYPE_LABEL.get(r.request_type)}</Text>
              {r.status === "open" ? (
                <Badge tone={daysLeft(r.due_at) < 0 ? "danger" : "warning"}>
                  {daysLeft(r.due_at) < 0
                    ? `Overdue ${-daysLeft(r.due_at)} days`
                    : `Due in ${daysLeft(r.due_at)} days`}
                </Badge>
              ) : (
                <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge>
              )}
            </Group>
          ))}
        </Stack>
      )}
      <Modal opened={adding} onClose={() => setAdding(false)} title="New privacy request" size="lg">
        <NewPrivacyRequestForm
          patientId={patient.id}
          saving={create.isPending}
          error={create.error}
          onSubmit={(data) => create.mutate(data)}
        />
      </Modal>
      <Modal
        opened={showHeld}
        onClose={() => setShowHeld(false)}
        title="What the hospital holds"
        size="md"
      >
        {held.isError ? (
          <Alert tone="danger">{held.error.message}</Alert>
        ) : (
          <Stack gap="sm" data-testid="data-summary">
            <List size="sm">
              {(held.data?.held ?? [])
                .filter((h) => h.count > 0)
                .map((h) => (
                  <List.Item key={h.category}>
                    {h.category}: {h.count}
                  </List.Item>
                ))}
            </List>
            <Text size="sm">
              {held.data?.staff_who_viewed ?? 0} staff opened this record in the last year.
            </Text>
            {(held.data?.insurers.length ?? 0) > 0 && (
              <Text size="sm">Shared with: {held.data?.insurers.join(", ")}</Text>
            )}
          </Stack>
        )}
      </Modal>
    </Card>
  );
}
