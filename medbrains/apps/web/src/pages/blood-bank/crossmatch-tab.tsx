// BLOOD-BANK CrossmatchTab — split from blood-bank.tsx (pure move).

import { Group, NumberInput, Select, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateCrossmatchRequestBody, CrossmatchRequest } from "@medbrains/types";
import { BLOOD_GROUP_OPTIONS, bloodGroupLabel, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, StatusDot } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PrintDocumentIconMenu } from "@/components/Print/PrintDocumentIconMenu";
import { Badge, Button, Modal, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const crossmatchStatusColors: Record<string, string> = {
  requested: "primary",
  testing: "warning",
  compatible: "success",
  incompatible: "danger",
  issued: "teal",
  cancelled: "slate",
};

function CreateCrossmatchForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: CreateCrossmatchRequestBody) => void;
  loading: boolean;
}) {
  const [patientId, setPatientId] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [componentType, setComponentType] = useState<string | null>("prbc");
  const [units, setUnits] = useState<number>(1);
  const [indication, setIndication] = useState("");

  return (
    <Stack>
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <Select
        label="Blood Group"
        required
        data={BLOOD_GROUP_OPTIONS}
        value={bloodGroup}
        onChange={setBloodGroup}
      />
      <Select
        label="Component Type"
        data={[
          { value: "prbc", label: "PRBC" },
          { value: "whole_blood", label: "Whole Blood" },
          { value: "ffp", label: "FFP" },
          { value: "platelets", label: "Platelets" },
        ]}
        value={componentType}
        onChange={setComponentType}
      />
      <NumberInput
        label="Units Requested"
        value={units}
        onChange={(v) => setUnits(Number(v))}
        min={1}
        max={10}
      />
      <Textarea
        label="Clinical Indication"
        value={indication}
        onChange={(e) => setIndication(e.currentTarget.value)}
      />
      <Button
        tone="primary"
        onClick={() => {
          if (!patientId || !bloodGroup) return;
          onSubmit({
            patient_id: patientId,
            blood_group: bloodGroup,
            component_type:
              (componentType as CreateCrossmatchRequestBody["component_type"]) ?? undefined,
            units_requested: units,
            clinical_indication: indication || undefined,
          });
        }}
        loading={loading}
      >
        Submit Request
      </Button>
    </Stack>
  );
}

export function CrossmatchTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.CROSSMATCH_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const [page, setPage] = useState(1);
  const { data: requests, isLoading } = useQuery({
    queryKey: ["blood-bank", "crossmatch", page],
    queryFn: () => bloodBankService.listCrossmatchRequests({ page, limit: 50 }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCrossmatchRequestBody) => bloodBankService.createCrossmatchRequest(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "crossmatch"] });
      closeCreate();
      toast.success("Crossmatch request submitted", { title: "Request created" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create request" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, result }: { id: string; status: string; result?: string }) =>
      bloodBankService.updateCrossmatchRequest(id, {
        status: status as CrossmatchRequest["status"],
        result,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "crossmatch"] });
      toast.success("Crossmatch request updated", { title: "Updated" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not update crossmatch" }),
  });

  const columns = [
    {
      key: "blood_group" as const,
      label: "Group",
      render: (r: CrossmatchRequest) => (
        <Badge tone="danger">{bloodGroupLabel(r.blood_group)}</Badge>
      ),
    },
    {
      key: "component_type" as const,
      label: "Component",
      render: (r: CrossmatchRequest) => r.component_type.toUpperCase(),
    },
    {
      key: "units_requested" as const,
      label: "Units",
      render: (r: CrossmatchRequest) => String(r.units_requested),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: CrossmatchRequest) => (
        <StatusDot label={r.status} color={crossmatchStatusColors[r.status] ?? "slate"} />
      ),
    },
    { key: "result" as const, label: "Result", render: (r: CrossmatchRequest) => r.result ?? "—" },
    {
      key: "created_at" as const,
      label: "Requested",
      render: (r: CrossmatchRequest) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (r: CrossmatchRequest) => (
        <Group gap={4}>
          {canCreate && r.status === "requested" && (
            <Button
              tone="secondary"
              size="compact-xs"
              onClick={() => updateMut.mutate({ id: r.id, status: "testing" })}
            >
              Start Testing
            </Button>
          )}
          {canCreate && r.status === "testing" && (
            <>
              <Button
                tone="secondary"
                size="compact-xs"
                onClick={() =>
                  updateMut.mutate({ id: r.id, status: "compatible", result: "compatible" })
                }
              >
                Compatible
              </Button>
              <Button
                tone="subtle-danger"
                size="compact-xs"
                onClick={() =>
                  updateMut.mutate({
                    id: r.id,
                    status: "incompatible",
                    result: "incompatible",
                  })
                }
              >
                Incompatible
              </Button>
            </>
          )}
          <PrintDocumentIconMenu
            idKind="crossmatch_request"
            recordId={r.id}
            recordLabel={`crossmatch request ${bloodGroupLabel(r.blood_group)} ${r.component_type}`}
          />
        </Group>
      ),
    },
  ];

  return (
    <Stack mt="md">
      <Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Crossmatch Request
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={requests?.data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        page={page}
        perPage={50}
        total={requests?.meta.total}
        totalPages={requests ? Math.ceil(requests.meta.total / requests.meta.limit) : 0}
        onPageChange={setPage}
      />

      <Modal opened={createOpen} onClose={closeCreate} title="New Crossmatch Request" fullScreen>
        <CreateCrossmatchForm onSubmit={(d) => createMut.mutate(d)} loading={createMut.isPending} />
      </Modal>
    </Stack>
  );
}
