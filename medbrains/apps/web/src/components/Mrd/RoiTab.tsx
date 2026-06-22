import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { RoiCreateInput } from "@medbrains/schemas";
import { roiCreateSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateRoiInput,
  ReviewRoiInput,
  RoiRequest,
  RoiRequesterType,
  RoiStatus,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, Input, Modal, Select, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const ROI_DEFAULTS: RoiCreateInput = {
  patient_id: "",
  requester_type: "patient",
  requester_name: "",
  purpose: "",
  authorization_obtained: false,
};

const STATUS_TONE: Record<RoiStatus, BadgeTone> = {
  pending: "warning",
  approved: "info",
  denied: "danger",
  released: "success",
  expired: "neutral",
};

const REQUESTER_OPTIONS: { value: RoiRequesterType; label: string }[] = [
  { value: "patient", label: "Patient" },
  { value: "insurer", label: "Insurer / TPA" },
  { value: "court", label: "Court" },
  { value: "police", label: "Police" },
  { value: "employer", label: "Employer" },
  { value: "other", label: "Other" },
];

export function RoiTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.RECORDS_LIST);
  const canReview = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, createModal] = useDisclosure(false);
  const [denyTarget, setDenyTarget] = useState<RoiRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [logFor, setLogFor] = useState<RoiRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["roi-requests", statusFilter],
    queryFn: () => mrdService.listRoiRequests(statusFilter ?? undefined),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["roi-requests"] });

  const review = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewRoiInput }) =>
      mrdService.reviewRoiRequest(id, data),
    onSuccess: () => {
      setDenyTarget(null);
      setDenyReason("");
      invalidate();
      toast.success("Request updated", { title: "ROI" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Review failed" }),
  });

  const release = useMutation({
    mutationFn: (id: string) => mrdService.recordRoiAccess(id, { action: "downloaded" }),
    onSuccess: () => {
      invalidate();
      toast.success("Release logged", { title: "ROI" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not log release" }),
  });

  const columns = [
    {
      key: "requester",
      label: "Requester",
      render: (r: RoiRequest) => (
        <Stack gap={0}>
          <Text fw={500}>{r.requester_name}</Text>
          <Text size="xs" c="dimmed">
            {r.requester_type}
          </Text>
        </Stack>
      ),
    },
    {
      key: "scope",
      label: "Scope",
      render: (r: RoiRequest) => (
        <Text size="sm">
          {r.record_scope}
          {r.date_from ? ` · ${r.date_from}→${r.date_to ?? ""}` : ""}
        </Text>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (r: RoiRequest) => (
        <Text size="sm" lineClamp={2}>
          {r.purpose ?? "—"}
        </Text>
      ),
    },
    {
      key: "auth",
      label: "Authorisation",
      render: (r: RoiRequest) =>
        r.authorization_obtained ? (
          <Badge tone="success" size="sm">
            Obtained
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            Pending
          </Badge>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: RoiRequest) => (
        <Stack gap={2}>
          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
          {r.decision_reason && (
            <Text size="xs" c="dimmed">
              {r.decision_reason}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: RoiRequest) => (
        <Group gap={4} wrap="nowrap">
          {canReview && r.status === "pending" && (
            <>
              <Button
                size="xs"
                tone="primary"
                loading={review.isPending}
                onClick={() => review.mutate({ id: r.id, data: { decision: "approved" } })}
              >
                Approve
              </Button>
              <Button size="xs" tone="danger" onClick={() => setDenyTarget(r)}>
                Deny
              </Button>
            </>
          )}
          {canReview && (r.status === "approved" || r.status === "released") && (
            <Button
              size="xs"
              tone="secondary"
              loading={release.isPending}
              onClick={() => release.mutate(r.id)}
            >
              Log release
            </Button>
          )}
          <Button size="xs" tone="ghost" onClick={() => setLogFor(r)}>
            Access log
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600}>Release of Information</Text>
          <Select
            placeholder="All statuses"
            data={["pending", "approved", "denied", "released", "expired"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            size="xs"
            w={160}
          />
        </Group>
        {canCreate && (
          <Button size="xs" tone="primary" onClick={createModal.open}>
            New request
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={requests} loading={isLoading} rowKey={(r) => r.id} />

      <CreateRoiModal opened={createOpen} onClose={createModal.close} onCreated={invalidate} />

      <Modal
        opened={denyTarget !== null}
        onClose={() => setDenyTarget(null)}
        title="Deny request"
        size="md"
      >
        <Stack>
          <Textarea
            label="Reason"
            value={denyReason}
            onChange={(e) => setDenyReason(e.currentTarget.value)}
            minRows={2}
            required
          />
          <Group justify="flex-end">
            <Button
              tone="danger"
              disabled={!denyReason.trim()}
              loading={review.isPending}
              onClick={() =>
                denyTarget &&
                review.mutate({
                  id: denyTarget.id,
                  data: { decision: "denied", decision_reason: denyReason.trim() },
                })
              }
            >
              Deny request
            </Button>
          </Group>
        </Stack>
      </Modal>

      {logFor && <AccessLogModal request={logFor} onClose={() => setLogFor(null)} />}
    </Stack>
  );
}

function CreateRoiModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoiCreateInput>({
    resolver: zodResolver(roiCreateSchema),
    defaultValues: ROI_DEFAULTS,
    mode: "onTouched",
  });

  const create = useMutation({
    mutationFn: (body: CreateRoiInput) => mrdService.createRoiRequest(body),
    onSuccess: () => {
      reset(ROI_DEFAULTS);
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create request" }),
  });

  const submit = handleSubmit((values) => {
    create.mutate({
      patient_id: values.patient_id,
      requester_type: values.requester_type,
      requester_name: values.requester_name.trim(),
      purpose: values.purpose?.trim() || undefined,
      authorization_obtained: values.authorization_obtained,
    });
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New ROI request" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={errors.patient_id?.message}
              label="Patient"
            />
          )}
        />
        <Controller
          control={control}
          name="requester_type"
          render={({ field }) => (
            <Select
              label="Requester type"
              data={REQUESTER_OPTIONS}
              value={field.value ?? null}
              onChange={(v) => field.onChange((v as RoiRequesterType) ?? "patient")}
              error={errors.requester_type?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="requester_name"
          render={({ field }) => (
            <Input
              label="Requester name"
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.requester_name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="purpose"
          render={({ field }) => (
            <Textarea
              label="Purpose"
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.purpose?.message}
              minRows={2}
            />
          )}
        />
        <Controller
          control={control}
          name="authorization_obtained"
          render={({ field }) => (
            <Select
              label="Patient authorisation obtained?"
              data={[
                { value: "yes", label: "Yes — patient consented" },
                { value: "no", label: "No / legal order" },
              ]}
              value={field.value ? "yes" : "no"}
              onChange={(v) => field.onChange(v === "yes")}
            />
          )}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" loading={create.isPending} onClick={() => void submit()}>
            Create request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AccessLogModal({ request, onClose }: { request: RoiRequest; onClose: () => void }) {
  const { data: log = [], isLoading } = useQuery({
    queryKey: ["roi-access-log", request.id],
    queryFn: () => mrdService.listRoiAccessLog(request.id),
  });

  return (
    <Modal opened onClose={onClose} title={`Access log — ${request.requester_name}`} size="md">
      <Stack gap="xs">
        {isLoading && <Text c="dimmed">Loading…</Text>}
        {!isLoading && log.length === 0 && (
          <Text size="sm" c="dimmed">
            No access recorded yet.
          </Text>
        )}
        {log.map((entry) => (
          <Group key={entry.id} justify="space-between">
            <Badge tone="info" size="sm">
              {entry.action}
            </Badge>
            <Text size="xs" c="dimmed">
              {new Date(entry.accessed_at).toLocaleString()}
            </Text>
          </Group>
        ))}
      </Stack>
    </Modal>
  );
}
