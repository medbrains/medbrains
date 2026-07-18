// IPD WardsTab — split from ipd.tsx (pure move).

import { Checkbox, Drawer, Group, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateWardRequest, UpdateWardRequest, WardListRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { IpTypeConfigSection } from "./ip-type-config";
import { WardBedsPanel } from "./ward-beds-panel";

function CreateWardDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [wardType, setWardType] = useState("general");
  const [genderRestriction, setGenderRestriction] = useState("any");

  const mutation = useMutation({
    mutationFn: (d: CreateWardRequest) => ipdService.createWard(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      onClose();
      setCode("");
      setName("");
      setDepartmentId("");
      setWardType("general");
      setGenderRestriction("any");
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New Ward" position="right" size="xl">
      <Stack>
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
        />
        <TextInput
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <DepartmentSelect value={departmentId} onChange={(id) => setDepartmentId(id)} />
        <Select
          label="Ward Type"
          data={["general", "icu", "nicu", "picu", "isolation", "hdu", "private", "semi_private"]}
          value={wardType}
          onChange={(v) => setWardType(v ?? "general")}
        />
        <Select
          label="Gender Restriction"
          data={[
            { value: "any", label: "Any" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
          value={genderRestriction}
          onChange={(v) => setGenderRestriction(v ?? "any")}
        />
        <Button
          tone="primary"
          onClick={() =>
            mutation.mutate({
              code,
              name,
              department_id: departmentId || undefined,
              ward_type: wardType,
              gender_restriction: genderRestriction,
            })
          }
          loading={mutation.isPending}
        >
          Create Ward
        </Button>
      </Stack>
    </Drawer>
  );
}

function EditWardDrawer({ ward, onClose }: { ward: WardListRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(ward?.name ?? "");
  const [wardType, setWardType] = useState(ward?.ward_type ?? "general");
  const [genderRestriction, setGenderRestriction] = useState(ward?.gender_restriction ?? "any");
  const [isActive, setIsActive] = useState(ward?.is_active ?? true);

  const mutation = useMutation({
    mutationFn: (d: UpdateWardRequest) => ipdService.updateWard(ward?.id ?? "", d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      onClose();
    },
  });

  if (!ward) return null;

  return (
    <Drawer
      opened={!!ward}
      onClose={onClose}
      title={`Edit Ward: ${ward.code}`}
      position="right"
      size="xl"
    >
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Select
          label="Ward Type"
          data={["general", "icu", "nicu", "picu", "isolation", "hdu", "private", "semi_private"]}
          value={wardType}
          onChange={(v) => setWardType(v ?? "general")}
        />
        <Select
          label="Gender Restriction"
          data={[
            { value: "any", label: "Any" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
          value={genderRestriction}
          onChange={(v) => setGenderRestriction(v ?? "any")}
        />
        <Checkbox
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
        <Button
          tone="primary"
          onClick={() =>
            mutation.mutate({
              name: name || undefined,
              ward_type: wardType || undefined,
              gender_restriction: genderRestriction || undefined,
              is_active: isActive,
            })
          }
          loading={mutation.isPending}
        >
          Save Changes
        </Button>
      </Stack>
    </Drawer>
  );
}

export function WardsTab() {
  const canManage = useHasPermission(P.IPD.WARDS_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editWard, setEditWard] = useState<WardListRow | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: () => ipdService.listWards(),
  });

  const wards = (data ?? []) as WardListRow[];

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: WardListRow) => (
        <Text size="sm" fw={500}>
          {row.code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (row: WardListRow) => <Text size="sm">{row.name}</Text> },
    {
      key: "department_name",
      label: "Department",
      render: (row: WardListRow) => <Text size="sm">{row.department_name ?? "—"}</Text>,
    },
    {
      key: "ward_type",
      label: "Type",
      render: (row: WardListRow) => <Badge size="sm">{row.ward_type}</Badge>,
    },
    {
      key: "beds",
      label: "Beds",
      render: (row: WardListRow) => (
        <Text size="sm">
          {row.vacant_beds}/{row.total_beds} available
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: WardListRow) => (
        <Badge size="xs" tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: WardListRow) => (
        <Group gap={4}>
          <Tooltip label="View beds">
            <IconButton aria-label="View beds" onClick={() => setSelectedWardId(row.id)}>
              <IconEye size={14} />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Tooltip label="Edit">
              <IconButton aria-label="Edit" onClick={() => setEditWard(row)}>
                <IconPencil size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={openCreate}
          >
            New Ward
          </Button>
        </Group>
      )}

      <DataTable columns={columns} data={wards} loading={isLoading} rowKey={(row) => row.id} />

      <CreateWardDrawer opened={createOpened} onClose={closeCreate} />
      <EditWardDrawer ward={editWard} onClose={() => setEditWard(null)} />

      <Drawer
        opened={!!selectedWardId}
        onClose={() => setSelectedWardId(null)}
        title="Ward Beds"
        position="right"
        size="lg"
      >
        {selectedWardId && <WardBedsPanel wardId={selectedWardId} canManage={canManage} />}
      </Drawer>

      {canManage && <IpTypeConfigSection />}
    </Stack>
  );
}
