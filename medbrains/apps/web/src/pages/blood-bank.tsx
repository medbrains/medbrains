import {
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  BbMsbosGuidelineRow,
  CreateBbMsbosRequest,
  CreateBbReturnRequest,
  CreateCrossmatchRequestBody,
  CrossmatchRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader, StatusDot } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { bloodBankService } from "@/services/bloodBank.service";
import { ColdChainTab } from "./blood-bank/cold-chain-tab";
import { ComplianceTab } from "./blood-bank/compliance-tab";
import { DonorsTab } from "./blood-bank/donors-tab";
import { InventoryTab } from "./blood-bank/inventory-tab";
import { ReportsTab } from "./blood-bank/reports-tab";
import { TransfusionsTab } from "./blood-bank/transfusions-tab";

const crossmatchStatusColors: Record<string, string> = {
  requested: "primary",
  testing: "warning",
  compatible: "success",
  incompatible: "danger",
  issued: "teal",
  cancelled: "slate",
};

// Dropdown options for categorical fields
// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function BloodBankPage() {
  useRequirePermission(P.BLOOD_BANK.DONORS_LIST);

  return (
    <div>
      <PageHeader title="Blood Bank" subtitle="Donor management, inventory & transfusion" />
      <Tabs defaultValue="donors">
        <Tabs.List>
          <Tabs.Tab value="donors">Donors</Tabs.Tab>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="crossmatch">Crossmatch</Tabs.Tab>
          <Tabs.Tab value="transfusions">Transfusions</Tabs.Tab>
          <Tabs.Tab value="reports">Reports</Tabs.Tab>
          <Tabs.Tab value="returns">Returns & MSBOS</Tabs.Tab>
          <Tabs.Tab value="coldchain">Cold Chain</Tabs.Tab>
          <Tabs.Tab value="compliance">Compliance</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="donors">
          <DonorsTab />
        </Tabs.Panel>
        <Tabs.Panel value="inventory">
          <InventoryTab />
        </Tabs.Panel>
        <Tabs.Panel value="crossmatch">
          <CrossmatchTab />
        </Tabs.Panel>
        <Tabs.Panel value="transfusions">
          <TransfusionsTab />
        </Tabs.Panel>
        <Tabs.Panel value="reports">
          <ReportsTab />
        </Tabs.Panel>
        <Tabs.Panel value="returns">
          <ReturnsAndMsbosTab />
        </Tabs.Panel>
        <Tabs.Panel value="coldchain">
          <ColdChainTab />
        </Tabs.Panel>
        <Tabs.Panel value="compliance">
          <ComplianceTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Donors Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Inventory Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Crossmatch Tab
// ══════════════════════════════════════════════════════════

function CrossmatchTab() {
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
      render: (r: CrossmatchRequest) => <Badge tone="danger">{r.blood_group}</Badge>,
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
    ...(canCreate
      ? [
          {
            key: "id" as const,
            label: "Actions",
            render: (r: CrossmatchRequest) => (
              <Group gap={4}>
                {r.status === "requested" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "testing" })}
                  >
                    Start Testing
                  </Button>
                )}
                {r.status === "testing" && (
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
              </Group>
            ),
          },
        ]
      : []),
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

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="New Crossmatch Request"
        position="right"
        size="xl"
      >
        <CreateCrossmatchForm onSubmit={(d) => createMut.mutate(d)} loading={createMut.isPending} />
      </Drawer>
    </Stack>
  );
}

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
        data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
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

// ══════════════════════════════════════════════════════════
//  Transfusions Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Reports Tab (TTI + Hemovigilance)
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Returns & MSBOS Tab
// ══════════════════════════════════════════════════════════

function ReturnsAndMsbosTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.BLOOD_BANK.INVENTORY_MANAGE);
  const canCreateXm = useHasPermission(P.BLOOD_BANK.CROSSMATCH_CREATE);
  const [returnOpen, { open: openReturn, close: closeReturn }] = useDisclosure(false);
  const [msbosOpen, { open: openMsbos, close: closeMsbos }] = useDisclosure(false);
  const [returnView, setReturnView] = useState("returns");

  const { data: msbos, isLoading: msbosLoading } = useQuery({
    queryKey: ["blood-bank", "msbos"],
    queryFn: () => bloodBankService.listBbMsbos(),
  });

  const [returnComponentId, setReturnComponentId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnTemp, setReturnTemp] = useState<number | undefined>();
  const [returnTimeOut, setReturnTimeOut] = useState<number | undefined>();

  const createReturnMut = useMutation({
    mutationFn: (d: CreateBbReturnRequest) => bloodBankService.createBbReturn(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank"] });
      closeReturn();
      toast.success("Blood return recorded", { title: "Return created" });
    },
  });

  const [msbosName, setMsbosName] = useState("");
  const [msbosCode, setMsbosCode] = useState("");
  const [msbosGroup, setMsbosGroup] = useState<string | null>(null);
  const [msbosType, setMsbosType] = useState<string | null>("prbc");
  const [msbosUnits, setMsbosUnits] = useState<number>(2);
  const [msbosNotes, setMsbosNotes] = useState("");

  const createMsbosMut = useMutation({
    mutationFn: (d: CreateBbMsbosRequest) => bloodBankService.createBbMsbos(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "msbos"] });
      closeMsbos();
      toast.success("Guideline saved", { title: "MSBOS added" });
    },
  });

  const msbosColumns = [
    {
      key: "procedure_name" as const,
      label: "Procedure",
      render: (r: BbMsbosGuidelineRow) => r.procedure_name,
    },
    {
      key: "procedure_code" as const,
      label: "Code",
      render: (r: BbMsbosGuidelineRow) => r.procedure_code,
    },
    {
      key: "component_type" as const,
      label: "Component",
      render: (r: BbMsbosGuidelineRow) => r.component_type.toUpperCase(),
    },
    {
      key: "max_units" as const,
      label: "Max Units",
      render: (r: BbMsbosGuidelineRow) => String(r.max_units),
    },
    {
      key: "is_active" as const,
      label: "Active",
      render: (r: BbMsbosGuidelineRow) =>
        r.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>,
    },
  ];

  return (
    <Stack mt="md">
      <SegmentedControl
        value={returnView}
        onChange={setReturnView}
        data={[
          { value: "returns", label: "Blood Returns" },
          { value: "msbos", label: "MSBOS Guidelines" },
        ]}
        w={340}
      />

      {returnView === "returns" && (
        <Stack>
          <Group>
            {canManage && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openReturn}>
                New Return
              </Button>
            )}
          </Group>
          <Text c="dimmed" size="sm">
            Returns are tracked per component. Use the drawer to log a blood return.
          </Text>

          <Drawer
            opened={returnOpen}
            onClose={closeReturn}
            title="Create Blood Return"
            position="right"
            size="xl"
          >
            <Stack>
              <TextInput
                label="Component ID"
                required
                value={returnComponentId}
                onChange={(e) => setReturnComponentId(e.currentTarget.value)}
                placeholder="UUID of blood component"
              />
              <Textarea
                label="Return Reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.currentTarget.value)}
              />
              <NumberInput
                label="Temperature at Return"
                value={returnTemp}
                onChange={(v) => setReturnTemp(v === "" ? undefined : Number(v))}
                suffix=" C"
              />
              <NumberInput
                label="Time Out (minutes)"
                value={returnTimeOut}
                onChange={(v) => setReturnTimeOut(v === "" ? undefined : Number(v))}
              />
              <Button
                tone="primary"
                onClick={() => {
                  if (!returnComponentId) return;
                  createReturnMut.mutate({
                    component_id: returnComponentId,
                    return_reason: returnReason || undefined,
                    temperature_at_return: returnTemp,
                    time_out_minutes: returnTimeOut,
                  });
                }}
                loading={createReturnMut.isPending}
              >
                Submit Return
              </Button>
            </Stack>
          </Drawer>
        </Stack>
      )}

      {returnView === "msbos" && (
        <Stack>
          <Group>
            {canCreateXm && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openMsbos}>
                Add MSBOS Guideline
              </Button>
            )}
          </Group>
          <DataTable
            columns={msbosColumns}
            data={msbos ?? []}
            loading={msbosLoading}
            rowKey={(r) => r.id}
          />

          <Drawer
            opened={msbosOpen}
            onClose={closeMsbos}
            title="Add MSBOS Guideline"
            position="right"
            size="xl"
          >
            <Stack>
              <TextInput
                label="Procedure Name"
                required
                value={msbosName}
                onChange={(e) => setMsbosName(e.currentTarget.value)}
              />
              <TextInput
                label="Procedure Code"
                required
                value={msbosCode}
                onChange={(e) => setMsbosCode(e.currentTarget.value)}
              />
              <Select
                label="Blood Group"
                data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
                clearable
                value={msbosGroup}
                onChange={setMsbosGroup}
              />
              <Select
                label="Component Type"
                required
                data={[
                  { value: "prbc", label: "PRBC" },
                  { value: "ffp", label: "FFP" },
                  { value: "platelets", label: "Platelets" },
                  { value: "whole_blood", label: "Whole Blood" },
                ]}
                value={msbosType}
                onChange={setMsbosType}
              />
              <NumberInput
                label="Max Units"
                required
                value={msbosUnits}
                onChange={(v) => setMsbosUnits(Number(v))}
                min={1}
                max={20}
              />
              <Textarea
                label="Notes"
                value={msbosNotes}
                onChange={(e) => setMsbosNotes(e.currentTarget.value)}
              />
              <Button
                tone="primary"
                onClick={() => {
                  if (!msbosName || !msbosCode || !msbosType) return;
                  createMsbosMut.mutate({
                    procedure_name: msbosName,
                    procedure_code: msbosCode,
                    blood_group: msbosGroup ?? undefined,
                    component_type: msbosType,
                    max_units: msbosUnits,
                    notes: msbosNotes || undefined,
                  });
                }}
                loading={createMsbosMut.isPending}
              >
                Save Guideline
              </Button>
            </Stack>
          </Drawer>
        </Stack>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Cold Chain Tab
// ══════════════════════════════════════════════════════════
