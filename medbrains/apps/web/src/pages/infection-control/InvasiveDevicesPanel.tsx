import { Drawer, Group, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateIndwellingDeviceRequest,
  IndwellingDevice,
  IndwellingDeviceType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Input, Select, Switch, TextArea, toast } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

const DEVICE_TYPES = [
  { value: "central_line", label: "Central line" },
  { value: "urinary_catheter", label: "Urinary catheter" },
  { value: "ventilator", label: "Ventilator" },
  { value: "peripheral_iv", label: "Peripheral IV" },
  { value: "other", label: "Other" },
];

const TYPE_LABEL: Record<string, string> = {
  central_line: "Central line",
  urinary_catheter: "Urinary catheter",
  ventilator: "Ventilator",
  peripheral_iv: "Peripheral IV",
  other: "Other",
};

const REVIEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

function daysIn(insertedAt: string): number {
  return Math.floor((Date.now() - new Date(insertedAt).getTime()) / (24 * 60 * 60 * 1000));
}
function reviewOverdue(lastReviewedAt: string): boolean {
  return Date.now() - new Date(lastReviewedAt).getTime() > REVIEW_INTERVAL_MS;
}

interface AddForm {
  patient_id: string;
  device_type: IndwellingDeviceType;
  site: string;
  indication: string;
}
const EMPTY_ADD: AddForm = {
  patient_id: "",
  device_type: "urinary_catheter",
  site: "",
  indication: "",
};

/** Per-patient indwelling-device register with daily necessity review (CDC/NABH CAUTI·CLABSI·VAP
 *  prevention). Each avoidable device-day carries infection risk, so devices overdue for review or
 *  deemed no-longer-indicated are flagged for prompt removal. */
export function InvasiveDevicesPanel() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const [patientFilter, setPatientFilter] = useState("");
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [reviewTarget, setReviewTarget] = useState<IndwellingDevice | null>(null);
  const [stillIndicated, setStillIndicated] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  const [removeTarget, setRemoveTarget] = useState<IndwellingDevice | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  const { data: devices, isLoading } = useQuery({
    queryKey: ["ic-indwelling-devices", patientFilter],
    queryFn: () =>
      infectionControlService.listIndwellingDevices(
        patientFilter ? { patient_id: patientFilter } : undefined,
      ),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ic-indwelling-devices"] });

  const addMut = useMutation({
    mutationFn: (payload: CreateIndwellingDeviceRequest) =>
      infectionControlService.createIndwellingDevice(payload),
    onSuccess: () => {
      void invalidate();
      closeAdd();
      setAddForm(EMPTY_ADD);
      toast.success("Device registered");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not register device" }),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, still }: { id: string; still: boolean }) =>
      infectionControlService.reviewIndwellingDevice(id, {
        still_indicated: still,
        notes: reviewNotes || undefined,
      }),
    onSuccess: (updated) => {
      void invalidate();
      setReviewTarget(null);
      setReviewNotes("");
      if (!updated.still_indicated) {
        toast.warning("Device marked no longer indicated — remove it as soon as possible.", {
          title: "Remove device",
        });
      } else {
        toast.success("Necessity review recorded");
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record review" }),
  });

  const removeMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      infectionControlService.removeIndwellingDevice(id, { removal_reason: reason }),
    onSuccess: () => {
      void invalidate();
      setRemoveTarget(null);
      setRemovalReason("");
      toast.success("Device removed");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not remove device" }),
  });

  const submitAdd = () => {
    if (!addForm.patient_id || !addForm.indication.trim()) {
      toast.error("Patient and indication are required");
      return;
    }
    addMut.mutate({
      patient_id: addForm.patient_id,
      device_type: addForm.device_type,
      site: addForm.site || undefined,
      indication: addForm.indication.trim(),
    });
  };

  const openReview = (d: IndwellingDevice) => {
    setReviewTarget(d);
    setStillIndicated(d.still_indicated);
    setReviewNotes("");
  };

  const columns: Column<IndwellingDevice>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (d) => <PatientNameCell patientId={d.patient_id} showUhid={false} />,
    },
    {
      key: "device_type",
      label: "Device",
      render: (d) => <Badge tone="neutral">{TYPE_LABEL[d.device_type] ?? d.device_type}</Badge>,
    },
    { key: "indication", label: "Indication", render: (d) => d.indication },
    {
      key: "inserted_at",
      label: "Days in",
      render: (d) => (d.removed_at ? "—" : `${daysIn(d.inserted_at)}d`),
    },
    {
      key: "last_reviewed_at",
      label: "Review",
      render: (d) => {
        if (d.removed_at) return <Badge tone="neutral">Removed</Badge>;
        if (!d.still_indicated) return <Badge tone="danger">Remove — not indicated</Badge>;
        return reviewOverdue(d.last_reviewed_at) ? (
          <Badge tone="warning">Review overdue</Badge>
        ) : (
          <Badge tone="success">Reviewed</Badge>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (d) =>
        d.removed_at ? null : (
          <Group gap={4}>
            {canCreate && (
              <Button tone="ghost" size="compact-xs" onClick={() => openReview(d)}>
                Review
              </Button>
            )}
            {canCreate && (
              <Button
                tone="danger-ghost"
                size="compact-xs"
                onClick={() => {
                  setRemoveTarget(d);
                  setRemovalReason("");
                }}
              >
                Remove
              </Button>
            )}
          </Group>
        ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <PatientSearchSelect
          label="Filter by patient"
          value={patientFilter}
          onChange={(id) => setPatientFilter(id)}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openAdd}>
            Register Device
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={devices ?? []} loading={isLoading} rowKey={(d) => d.id} />

      <Drawer
        opened={addOpen}
        onClose={closeAdd}
        title="Register device"
        position="right"
        size="md"
      >
        <Stack gap="sm">
          <PatientSearchSelect
            label="Patient"
            required
            value={addForm.patient_id}
            onChange={(id) => setAddForm({ ...addForm, patient_id: id })}
          />
          <Select
            label="Device type"
            required
            data={DEVICE_TYPES}
            value={addForm.device_type}
            onChange={(v) =>
              setAddForm({ ...addForm, device_type: (v as IndwellingDeviceType) ?? "other" })
            }
          />
          <Input
            label="Site"
            value={addForm.site}
            onChange={(e) => setAddForm({ ...addForm, site: e.currentTarget.value })}
          />
          <TextArea
            label="Indication (clinical reason it is in place)"
            required
            value={addForm.indication}
            onChange={(e) => setAddForm({ ...addForm, indication: e.currentTarget.value })}
          />
          <Button tone="primary" loading={addMut.isPending} onClick={submitAdd} w="fit-content">
            Register
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title="Daily necessity review"
      >
        <Stack gap="sm">
          <Text size="sm">
            Is this device still clinically indicated? Remove as soon as it is not — every avoidable
            device-day raises infection risk.
          </Text>
          <Switch
            label="Still indicated"
            checked={stillIndicated}
            onChange={(e) => setStillIndicated(e.currentTarget.checked)}
          />
          {!stillIndicated && (
            <Alert tone="warning">
              Marking this not indicated flags it for removal — remove the device promptly.
            </Alert>
          )}
          <TextArea
            label="Notes"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            loading={reviewMut.isPending}
            onClick={() =>
              reviewTarget && reviewMut.mutate({ id: reviewTarget.id, still: stillIndicated })
            }
          >
            Save review
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove device"
      >
        <Stack gap="sm">
          <TextArea
            label="Removal reason"
            required
            value={removalReason}
            onChange={(e) => setRemovalReason(e.currentTarget.value)}
          />
          <Button
            tone="danger"
            loading={removeMut.isPending}
            disabled={!removalReason.trim()}
            onClick={() =>
              removeTarget &&
              removeMut.mutate({ id: removeTarget.id, reason: removalReason.trim() })
            }
          >
            Confirm removal
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
