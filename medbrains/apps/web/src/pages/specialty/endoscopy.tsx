import { useState } from "react";
import {
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  EndoscopyProcedure,
  EndoscopyScope,
  EndoscopyReprocessing,
  CreateEndoscopyProcedureRequest,
  CreateEndoscopyScopeRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const SCOPE_STATUS_COLORS: Record<string, string> = {
  available: "success", in_use: "primary", reprocessing: "orange", quarantine: "danger", decommissioned: "slate",
};

const HLD_COLORS: Record<string, string> = { pass: "success", fail: "danger", pending: "warning" };

export function EndoscopyPage() {
  useRequirePermission(P.SPECIALTY.ENDOSCOPY.PROCEDURES_LIST);
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.ENDOSCOPY.PROCEDURES_CREATE);
  const canScopes = useHasPermission(P.SPECIALTY.ENDOSCOPY.SCOPES_MANAGE);

  const [tab, setTab] = useState<string | null>("procedures");
  const [procOpen, procHandlers] = useDisclosure(false);
  const [scopeOpen, scopeHandlers] = useDisclosure(false);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["endo-procedures"],
    queryFn: () => api.listEndoscopyProcedures(),
  });

  const { data: scopes = [], isLoading: scopesLoading } = useQuery({
    queryKey: ["endo-scopes"],
    queryFn: () => api.listEndoscopyScopes(),
  });

  const { data: reprocessing = [] } = useQuery({
    queryKey: ["endo-reprocessing"],
    queryFn: () => api.listEndoscopyReprocessing(),
  });

  // ── Create Procedure ──
  const [procForm, setProcForm] = useState<CreateEndoscopyProcedureRequest>({
    patient_id: "", procedure_type: "",
  });

  const createProc = useMutation({
    mutationFn: (data: CreateEndoscopyProcedureRequest) => api.createEndoscopyProcedure(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["endo-procedures"] });
      procHandlers.close();
      notifications.show({ title: "Created", message: "Procedure recorded", color: "success" });
    },
  });

  // ── Create Scope ──
  const [scopeForm, setScopeForm] = useState<CreateEndoscopyScopeRequest>({ serial_number: "" });

  const createScope = useMutation({
    mutationFn: (data: CreateEndoscopyScopeRequest) => api.createEndoscopyScope(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["endo-scopes"] });
      scopeHandlers.close();
      notifications.show({ title: "Created", message: "Scope registered", color: "success" });
    },
  });

  const procCols: Column<EndoscopyProcedure>[] = [
    { key: "procedure_type", label: "Type", render: (r) => <Badge>{r.procedure_type}</Badge> },
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "sedation", label: "Sedation", render: (r) => <Text size="sm">{r.sedation_type ?? "None"}</Text> },
    { key: "biopsy", label: "Biopsy", render: (r) => r.biopsy_taken ? <Badge color="orange">Yes</Badge> : <Text size="sm">No</Text> },
    { key: "aldrete", label: "Aldrete (Post)", render: (r) => <Text size="sm">{r.aldrete_score_post ?? "—"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const scopeCols: Column<EndoscopyScope>[] = [
    { key: "serial_number", label: "Serial #", render: (r) => <Text size="sm" fw={500}>{r.serial_number}</Text> },
    { key: "model", label: "Model", render: (r) => <Text size="sm">{r.model ?? "—"}</Text> },
    { key: "scope_type", label: "Type", render: (r) => <Text size="sm">{r.scope_type ?? "—"}</Text> },
    { key: "status", label: "Status", render: (r) => <Badge color={SCOPE_STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "total_uses", label: "Uses", render: (r) => <Text size="sm">{r.total_uses}</Text> },
    { key: "last_hld", label: "Last HLD", render: (r) => <Text size="sm">{r.last_hld_at ? new Date(r.last_hld_at).toLocaleDateString() : "Never"}</Text> },
    { key: "culture", label: "Last Culture", render: (r) => <Text size="sm">{r.last_culture_result ?? "—"}</Text> },
  ];

  const reprocCols: Column<EndoscopyReprocessing>[] = [
    { key: "scope_id", label: "Scope", render: (r) => <Text size="sm">{r.scope_id.slice(0, 8)}</Text> },
    { key: "leak_test", label: "Leak Test", render: (r) => r.leak_test_passed ? <Badge color="success">Pass</Badge> : <Badge color="danger">Fail</Badge> },
    { key: "chemical", label: "Chemical", render: (r) => <Text size="sm">{r.hld_chemical ?? "—"}</Text> },
    { key: "soak", label: "Soak (min)", render: (r) => <Text size="sm">{r.hld_soak_minutes ?? "—"}</Text> },
    { key: "result", label: "HLD Result", render: (r) => <Badge color={HLD_COLORS[r.hld_result] ?? "slate"}>{r.hld_result}</Badge> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  return (
    <div>
      <PageHeader
        title="Endoscopy"
        subtitle="GI procedures, scope management, and HLD reprocessing"
        actions={
          <Group>
            {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={procHandlers.open}>New Procedure</Button>}
            {canScopes && <Button variant="light" leftSection={<IconPlus size={16} />} onClick={scopeHandlers.open}>Add Scope</Button>}
          </Group>
        }
      />

      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="procedures">Procedures</Tabs.Tab>
          <Tabs.Tab value="scopes">Scope Management</Tabs.Tab>
          <Tabs.Tab value="reprocessing">Reprocessing</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="procedures" pt="md">
          <DataTable columns={procCols} data={procedures} loading={isLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>

        <Tabs.Panel value="scopes" pt="md">
          <DataTable columns={scopeCols} data={scopes} loading={scopesLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>

        <Tabs.Panel value="reprocessing" pt="md">
          <DataTable columns={reprocCols} data={reprocessing} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={procOpen} onClose={procHandlers.close} title="New Endoscopy Procedure" size="lg" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={procForm.patient_id} onChange={(e) => setProcForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <TextInput label="Procedure Type" required value={procForm.procedure_type} onChange={(e) => setProcForm((p) => ({ ...p, procedure_type: e.currentTarget.value }))} />
          <Select label="Scope" data={scopes.filter((s) => s.status === "available").map((s) => ({ value: s.id, label: `${s.serial_number} (${s.model ?? "Unknown"})` }))} value={procForm.scope_id ?? null} onChange={(v) => setProcForm((p) => ({ ...p, scope_id: v ?? undefined }))} />
          <TextInput label="Sedation Type" value={procForm.sedation_type ?? ""} onChange={(e) => setProcForm((p) => ({ ...p, sedation_type: e.currentTarget.value }))} />
          <NumberInput label="Aldrete Score (Pre)" value={procForm.aldrete_score_pre ?? ""} onChange={(v) => setProcForm((p) => ({ ...p, aldrete_score_pre: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="Aldrete Score (Post)" value={procForm.aldrete_score_post ?? ""} onChange={(v) => setProcForm((p) => ({ ...p, aldrete_score_post: typeof v === "number" ? v : undefined }))} />
          <Button onClick={() => createProc.mutate(procForm)} loading={createProc.isPending}>Create Procedure</Button>
        </Stack>
      </Drawer>

      <Drawer opened={scopeOpen} onClose={scopeHandlers.close} title="Register New Scope" size="md" position="right">
        <Stack>
          <TextInput label="Serial Number" required value={scopeForm.serial_number} onChange={(e) => setScopeForm((p) => ({ ...p, serial_number: e.currentTarget.value }))} />
          <TextInput label="Model" value={scopeForm.model ?? ""} onChange={(e) => setScopeForm((p) => ({ ...p, model: e.currentTarget.value }))} />
          <TextInput label="Scope Type" value={scopeForm.scope_type ?? ""} onChange={(e) => setScopeForm((p) => ({ ...p, scope_type: e.currentTarget.value }))} />
          <Button onClick={() => createScope.mutate(scopeForm)} loading={createScope.isPending}>Register Scope</Button>
        </Stack>
      </Drawer>
    </div>
  );
}
