/**
 * The privacy officer's register of DPDP requests: what each patient asked
 * for, when it arrived, how many of its 90 days are left, and the answer.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PrivacyRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { daysLeft, PRIVACY_TYPE_LABEL } from "@/components/Patient/privacy-request-labels";
import { Alert, Badge, Button, Modal, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

const decisionSchema = z.object({
  status: z.enum(["completed", "refused"]),
  decision: z.string().trim().min(5, "Say what was done, or why it is refused"),
});
type Decision = z.infer<typeof decisionSchema>;

function DueBadge({ request }: { request: PrivacyRequest }) {
  if (request.status !== "open") {
    return (
      <Badge tone={request.status === "completed" ? "success" : "neutral"}>{request.status}</Badge>
    );
  }
  const left = daysLeft(request.due_at);
  return (
    <Badge tone={left < 0 ? "danger" : left <= 14 ? "warning" : "info"}>
      {left < 0 ? `Overdue ${-left}d` : `${left} days left`}
    </Badge>
  );
}

function AnswerForm({ request, onDone }: { request: PrivacyRequest; onDone: () => void }) {
  const qc = useQueryClient();
  const { control, handleSubmit } = useForm<Decision>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { status: "completed", decision: "" },
  });
  const decide = useMutation({
    mutationFn: (v: Decision) => patientDetailService.decidePrivacyRequest(request.id, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-requests"] });
      toast.success("Request answered");
      onDone();
    },
  });
  return (
    <Stack
      component="form"
      gap="sm"
      aria-label="Answer request"
      onSubmit={handleSubmit((v) => decide.mutate(v))}
    >
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SegmentedControl
            aria-label="Outcome"
            data={[
              { value: "completed", label: "Done" },
              { value: "refused", label: "Refused" },
            ]}
            {...field}
          />
        )}
      />
      <Controller
        control={control}
        name="decision"
        render={({ field, fieldState }) => (
          <Textarea
            {...field}
            label="Answer to the patient"
            description="For an erasure refused because the medical record must be kept, name the rule"
            withAsterisk
            autosize
            minRows={3}
            error={fieldState.error?.message}
          />
        )}
      />
      {decide.isError && <Alert tone="danger">{decide.error.message}</Alert>}
      <Button tone="primary" type="submit" loading={decide.isPending}>
        Record answer
      </Button>
    </Stack>
  );
}

export function PrivacyRequestsTab() {
  const canDecide = useHasPermission(P.PATIENTS.PRIVACY_REQUESTS_DECIDE);
  const [status, setStatus] = useState("open");
  const [answering, setAnswering] = useState<PrivacyRequest | null>(null);
  const requests = useQuery({
    queryKey: ["privacy-requests", "register", status],
    queryFn: () =>
      patientDetailService.listPrivacyRequests(status === "all" ? undefined : { status }),
  });
  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label="Show"
        value={status}
        onChange={setStatus}
        data={[
          { value: "open", label: "Open" },
          { value: "completed", label: "Done" },
          { value: "refused", label: "Refused" },
          { value: "all", label: "All" },
        ]}
      />
      <DataTable
        data={requests.data ?? []}
        loading={requests.isLoading}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No privacy requests"
        columns={[
          {
            key: "patient",
            label: "Patient",
            render: (r) => (
              <Text size="sm">
                {r.patient_name} · {r.uhid}
              </Text>
            ),
          },
          {
            key: "type",
            label: "Asked to",
            render: (r) => <Text size="sm">{PRIVACY_TYPE_LABEL.get(r.request_type)}</Text>,
          },
          {
            key: "received",
            label: "Received",
            render: (r) => (
              <Text size="sm">
                {new Date(r.received_at).toLocaleDateString()} · {r.received_via}
              </Text>
            ),
          },
          { key: "due", label: "Due", render: (r) => <DueBadge request={r} /> },
          {
            key: "answer",
            label: "",
            render: (r) =>
              canDecide && r.status === "open" ? (
                <Button tone="secondary" size="compact-xs" onClick={() => setAnswering(r)}>
                  Answer
                </Button>
              ) : (
                <Text size="xs" c="dimmed">
                  {r.decision ?? ""}
                </Text>
              ),
          },
        ]}
      />
      <Modal
        opened={answering !== null}
        onClose={() => setAnswering(null)}
        title="Answer privacy request"
        size="md"
      >
        {answering && (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              {answering.patient_name} asked to{" "}
              {PRIVACY_TYPE_LABEL.get(answering.request_type)?.toLowerCase()}
            </Text>
            <Text size="sm">{answering.details}</Text>
            {answering.nominee_name && (
              <Text size="sm">
                Nominee: {answering.nominee_name}
                {answering.nominee_relation ? ` (${answering.nominee_relation})` : ""}
                {answering.nominee_contact ? ` · ${answering.nominee_contact}` : ""}
              </Text>
            )}
            <AnswerForm request={answering} onDone={() => setAnswering(null)} />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
