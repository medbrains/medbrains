import { Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { GroupDashboard, HospitalGroup, HospitalKpiSummary } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconBuildingHospital, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { multiHospitalService } from "@/services/multiHospital.service";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function CreateGroupModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const create = useMutation({
    mutationFn: () =>
      multiHospitalService.createHospitalGroup({
        code,
        name,
        display_name: displayName || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hospital-groups"] });
      toast.success("Group created", { title: "Hospital groups" });
      onClose();
      setCode("");
      setName("");
      setDisplayName("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Create failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create hospital group">
      <Stack gap="sm">
        <TextInput
          label="Code"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          placeholder="APOLLO"
          required
        />
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
        />
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!code.trim() || !name.trim()}
        >
          Create
        </Button>
      </Stack>
    </Modal>
  );
}

function GroupDashboardPanel({ groupId }: { groupId: string }) {
  const { data } = useQuery<GroupDashboard>({
    queryKey: ["group-dashboard", groupId],
    queryFn: () => multiHospitalService.getGroupDashboard(groupId),
  });
  if (!data) return null;

  const cols: Column<HospitalKpiSummary>[] = [
    { key: "hospital_name", label: "Hospital", render: (r) => r.hospital_name },
    { key: "region_name", label: "Region", render: (r) => r.region_name || "—" },
    {
      key: "occupancy_pct",
      label: "Occupancy",
      render: (r) => `${Math.round(r.occupancy_pct)}% (${r.occupied_beds}/${r.total_beds})`,
    },
    { key: "opd_visits", label: "OPD", render: (r) => r.opd_visits },
    { key: "admissions", label: "Admissions", render: (r) => r.admissions },
    { key: "revenue", label: "Revenue", render: (r) => inr(r.revenue) },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Occupancy
          </Text>
          <Text fw={600}>{Math.round(data.overall_occupancy_pct)}%</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            OPD visits
          </Text>
          <Text fw={600}>{data.total_opd_visits.toLocaleString("en-IN")}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Admissions
          </Text>
          <Text fw={600}>{data.total_admissions.toLocaleString("en-IN")}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Revenue
          </Text>
          <Text fw={600}>{inr(data.total_revenue)}</Text>
        </Card>
      </SimpleGrid>
      <DataTable
        columns={cols}
        data={data.hospitals}
        rowKey={(r) => r.tenant_id}
        emptyTitle="No hospitals in this group yet."
      />
    </Stack>
  );
}

function HospitalsPanel({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const [toAdd, setToAdd] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["group-hospitals", groupId],
    queryFn: () => multiHospitalService.listHospitalsInGroup(groupId),
  });
  const { data: allHospitals = [] } = useQuery({
    queryKey: ["all-hospitals"],
    queryFn: () => multiHospitalService.listAllHospitals(),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["group-hospitals", groupId] });
    void qc.invalidateQueries({ queryKey: ["all-hospitals"] });
    void qc.invalidateQueries({ queryKey: ["hospital-groups"] });
  };
  const add = useMutation({
    mutationFn: () =>
      multiHospitalService.assignHospitalToGroup({ tenant_id: toAdd ?? "", group_id: groupId }),
    onSuccess: () => {
      invalidate();
      toast.success("Hospital added to group", { title: "Hospital groups" });
      setToAdd(null);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Add failed" }),
  });
  const remove = useMutation({
    mutationFn: (tenantId: string) => multiHospitalService.removeHospitalFromGroup(tenantId),
    onSuccess: () => {
      invalidate();
      toast.success("Hospital removed", { title: "Hospital groups" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Remove failed" }),
  });

  const unassigned = allHospitals.filter((h) => !h.group_id);

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm">
        <Select
          label="Add hospital"
          placeholder="Unassigned hospitals"
          data={unassigned.map((h) => ({ value: h.id, label: `${h.name} (${h.code})` }))}
          value={toAdd}
          onChange={setToAdd}
          searchable
          style={{ flex: 1 }}
        />
        <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!toAdd}>
          Add
        </Button>
      </Group>
      {members.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hospitals in this group yet.
        </Text>
      ) : (
        members.map((h) => (
          <Group key={h.id} justify="space-between">
            <Text size="sm">
              {h.name}
              {h.is_headquarters ? " · HQ" : ""}
            </Text>
            <Button
              size="xs"
              tone="danger"
              onClick={() => remove.mutate(h.id)}
              loading={remove.isPending}
            >
              Remove
            </Button>
          </Group>
        ))
      )}
    </Stack>
  );
}

export function HospitalGroupsPage() {
  useRequirePermission(P.ADMIN.SYSTEM_STATE.VIEW);
  const [modalOpen, modal] = useDisclosure(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [manageHospitals, setManageHospitals] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["hospital-groups"],
    queryFn: () => multiHospitalService.listHospitalGroups(),
  });

  const columns: Column<HospitalGroup>[] = [
    { key: "code", label: "Code", render: (r) => r.code },
    { key: "name", label: "Name", render: (r) => r.display_name || r.name },
    { key: "default_currency", label: "Currency", render: (r) => r.default_currency },
    {
      key: "open",
      label: "",
      render: (r) => (
        <Group gap="xs">
          <Button size="xs" tone="secondary" onClick={() => setManageHospitals(r.id)}>
            Hospitals
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setSelected(r.id)}>
            Dashboard
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Hospital groups"
        subtitle="Chains, their hospitals and consolidated KPIs"
        icon={<IconBuildingHospital size={20} />}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Create group
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={groups}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No hospital groups configured."
      />
      {manageHospitals && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Manage hospitals</Text>
            <Button size="xs" tone="ghost" onClick={() => setManageHospitals(null)}>
              Close
            </Button>
          </Group>
          <HospitalsPanel groupId={manageHospitals} />
        </Card>
      )}
      {selected && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Group dashboard</Text>
            <Button size="xs" tone="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </Group>
          <GroupDashboardPanel groupId={selected} />
        </Card>
      )}
      <CreateGroupModal opened={modalOpen} onClose={modal.close} />
    </Stack>
  );
}
