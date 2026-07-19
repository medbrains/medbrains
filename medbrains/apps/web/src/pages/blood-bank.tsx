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
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { bloodBankService } from "@/services/bloodBank.service";
import { ColdChainTab } from "./blood-bank/cold-chain-tab";
import { ComplianceTab } from "./blood-bank/compliance-tab";
import { CrossmatchTab } from "./blood-bank/crossmatch-tab";
import { DonorsTab } from "./blood-bank/donors-tab";
import { InventoryTab } from "./blood-bank/inventory-tab";
import { ReportsTab } from "./blood-bank/reports-tab";
import { TransfusionsTab } from "./blood-bank/transfusions-tab";

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
