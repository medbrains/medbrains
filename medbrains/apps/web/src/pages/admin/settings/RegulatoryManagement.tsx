import { useState } from "react";
import { useHashTabs } from "../../../hooks/useHashTabs";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconLink,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  CreateRegulatoryBodyRequest,
  CreateRegulatoryLinkRequest,
  FieldMasterFull,
  RegulatoryBodyFull,
  RegulatoryClauseWithContext,
  RequirementLevel,
  UpdateRegulatoryBodyRequest,
  UpdateRegulatoryLinkRequest,
} from "@medbrains/types";
import { DataTable } from "../../../components";

// ── Constants ─────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  international: "primary",
  national: "success",
  state: "orange",
  education: "violet",
};

const REQUIREMENT_COLORS: Record<string, string> = {
  mandatory: "danger",
  conditional: "orange",
  recommended: "warning",
  optional: "slate",
};

const LEVEL_OPTIONS = [
  { value: "international", label: "International" },
  { value: "national", label: "National" },
  { value: "state", label: "State" },
  { value: "education", label: "Education" },
];

const REQUIREMENT_OPTIONS = [
  { value: "mandatory", label: "Mandatory" },
  { value: "conditional", label: "Conditional" },
  { value: "recommended", label: "Recommended" },
  { value: "optional", label: "Optional" },
];

// ── Body Create/Edit Modal ───────────────────────────────

function BodyModal({
  opened,
  onClose,
  editingBody,
}: {
  opened: boolean;
  onClose: () => void;
  editingBody: RegulatoryBodyFull | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingBody;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string>("national");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleOpen = () => {
    if (editingBody) {
      setCode(editingBody.code);
      setName(editingBody.name);
      setLevel(editingBody.level);
      setDescription(editingBody.description ?? "");
      setIsActive(editingBody.is_active);
    } else {
      setCode("");
      setName("");
      setLevel("national");
      setDescription("");
      setIsActive(true);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateRegulatoryBodyRequest) =>
      api.adminCreateRegulatoryBody(data),
    onSuccess: () => {
      notifications.show({
        title: "Body created",
        message: "Regulatory body has been created",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-regulatory-bodies"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRegulatoryBodyRequest) =>
      api.adminUpdateRegulatoryBody(editingBody!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Body updated",
        message: "Regulatory body has been updated",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-regulatory-bodies"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (isEdit) {
      updateMutation.mutate({
        name: name || undefined,
        description: description || undefined,
        is_active: isActive,
      });
    } else {
      createMutation.mutate({
        code,
        name,
        level: level as CreateRegulatoryBodyRequest["level"],
        description: description || undefined,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Regulatory Body" : "New Regulatory Body"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="NABH"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="National Accreditation Board for Hospitals"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Level"
          data={LEVEL_OPTIONS}
          value={level}
          onChange={(v) => setLevel(v ?? "national")}
          disabled={isEdit}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
        />
        {isEdit && (
          <Switch
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Link Create/Edit Modal ───────────────────────────────

function LinkModal({
  opened,
  onClose,
  editingLink,
}: {
  opened: boolean;
  onClose: () => void;
  editingLink: RegulatoryClauseWithContext | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingLink;

  const [fieldId, setFieldId] = useState<string | null>(null);
  const [bodyId, setBodyId] = useState<string | null>(null);
  const [requirementLevel, setRequirementLevel] = useState<string>("mandatory");
  const [clauseReference, setClauseReference] = useState("");
  const [clauseCode, setClauseCode] = useState("");
  const [description, setDescription] = useState("");

  const { data: allFields } = useQuery({
    queryKey: ["admin-fields-all"],
    queryFn: () => api.adminListFields(),
    staleTime: 60_000,
    enabled: opened,
  });

  const { data: allBodies } = useQuery({
    queryKey: ["admin-regulatory-bodies"],
    queryFn: () => api.adminListRegulatoryBodies(),
    staleTime: 60_000,
    enabled: opened,
  });

  const fieldOptions = (allFields ?? []).map((f: FieldMasterFull) => ({
    value: f.id,
    label: `${f.code} — ${f.name}`,
  }));

  const bodyOptions = (allBodies ?? []).map((b: RegulatoryBodyFull) => ({
    value: b.id,
    label: `${b.code} — ${b.name}`,
  }));

  const handleOpen = () => {
    if (editingLink) {
      setFieldId(editingLink.field_id);
      setBodyId(editingLink.regulatory_body_id);
      setRequirementLevel(editingLink.requirement_level);
      setClauseReference(editingLink.clause_reference ?? "");
      setClauseCode(editingLink.clause_code ?? "");
      setDescription(editingLink.description ?? "");
    } else {
      setFieldId(null);
      setBodyId(null);
      setRequirementLevel("mandatory");
      setClauseReference("");
      setClauseCode("");
      setDescription("");
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateRegulatoryLinkRequest) =>
      api.adminCreateRegulatoryLink(data),
    onSuccess: () => {
      notifications.show({
        title: "Link created",
        message: "Regulatory link has been created",
        color: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-regulatory-clauses"],
      });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRegulatoryLinkRequest) =>
      api.adminUpdateRegulatoryLink(editingLink!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Link updated",
        message: "Regulatory link has been updated",
        color: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-regulatory-clauses"],
      });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (isEdit) {
      updateMutation.mutate({
        requirement_level: requirementLevel as RequirementLevel,
        clause_reference: clauseReference || undefined,
        clause_code: clauseCode || undefined,
        description: description || undefined,
      });
    } else {
      if (!fieldId || !bodyId) {
        notifications.show({
          title: "Missing fields",
          message: "Please select both a field and a regulatory body",
          color: "danger",
        });
        return;
      }
      createMutation.mutate({
        field_id: fieldId,
        regulatory_body_id: bodyId,
        requirement_level: requirementLevel as RequirementLevel,
        clause_reference: clauseReference || undefined,
        clause_code: clauseCode || undefined,
        description: description || undefined,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Regulatory Link" : "New Regulatory Link"}
      size="lg"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <Select
          label="Field"
          data={fieldOptions}
          value={fieldId}
          onChange={setFieldId}
          searchable
          clearable
          disabled={isEdit}
          required
          placeholder="Search fields..."
        />
        <Select
          label="Regulatory Body"
          data={bodyOptions}
          value={bodyId}
          onChange={setBodyId}
          searchable
          clearable
          disabled={isEdit}
          required
          placeholder="Select body..."
        />
        <Select
          label="Requirement Level"
          data={REQUIREMENT_OPTIONS}
          value={requirementLevel}
          onChange={(v) => setRequirementLevel(v ?? "mandatory")}
          required
        />
        <Group grow>
          <TextInput
            label="Clause Reference"
            placeholder="Section 4.2.1"
            value={clauseReference}
            onChange={(e) => setClauseReference(e.currentTarget.value)}
          />
          <TextInput
            label="Clause Code"
            placeholder="NABH.AAC.2"
            value={clauseCode}
            onChange={(e) => setClauseCode(e.currentTarget.value)}
          />
        </Group>
        <Textarea
          label="Description"
          placeholder="What this clause requires..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Bodies Sub-Tab ────────────────────────────────────────

function BodiesTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBody, setEditingBody] = useState<RegulatoryBodyFull | null>(
    null,
  );

  const { data: bodies, isLoading } = useQuery({
    queryKey: ["admin-regulatory-bodies"],
    queryFn: () => api.adminListRegulatoryBodies(),
  });

  const filtered = (bodies ?? []).filter((b) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      b.code.toLowerCase().includes(q) ||
      b.name.toLowerCase().includes(q) ||
      (b.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const openCreate = () => {
    setEditingBody(null);
    setModalOpen(true);
  };

  const openEdit = (body: RegulatoryBodyFull) => {
    setEditingBody(body);
    setModalOpen(true);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: RegulatoryBodyFull) => (
        <Text size="sm" ff="monospace" fw={500}>
          {row.code}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: RegulatoryBodyFull) => row.name,
    },
    {
      key: "level",
      label: "Level",
      render: (row: RegulatoryBodyFull) => (
        <Badge
          size="sm"
          variant="light"
          color={LEVEL_COLORS[row.level] ?? "slate"}
        >
          {row.level}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row: RegulatoryBodyFull) => (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.description ?? "-"}
        </Text>
      ),
    },
    {
      key: "active",
      label: "Active",
      render: (row: RegulatoryBodyFull) =>
        row.is_active ? (
          <IconCheck size={14} color="var(--mantine-color-green-6)" />
        ) : (
          <IconX size={14} color="var(--mantine-color-red-6)" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: RegulatoryBodyFull) => (
        <ActionIcon variant="subtle" color="primary" onClick={() => openEdit(row)} aria-label="Edit">
          <IconPencil size={16} />
        </ActionIcon>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <TextInput
          placeholder="Search bodies..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          New Body
        </Button>
      </Group>

      <DataTable<RegulatoryBodyFull>
        columns={columns}
        data={filtered}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconShield size={32} />}
        emptyTitle="No regulatory bodies found"
        emptyDescription={
          debouncedSearch
            ? "Try adjusting your search"
            : "No regulatory bodies configured"
        }
      />

      <BodyModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingBody={editingBody}
      />
    </>
  );
}

// ── Field Links Sub-Tab ──────────────────────────────────

function FieldLinksTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] =
    useState<RegulatoryClauseWithContext | null>(null);

  const { data: clauses, isLoading } = useQuery({
    queryKey: ["admin-regulatory-clauses", "all-links"],
    queryFn: () => api.adminListRegulatoryClauses(),
  });

  const filtered = (clauses ?? []).filter((c) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      c.body_code.toLowerCase().includes(q) ||
      c.body_name.toLowerCase().includes(q) ||
      c.field_code.toLowerCase().includes(q) ||
      c.field_name.toLowerCase().includes(q) ||
      (c.clause_code?.toLowerCase().includes(q) ?? false) ||
      (c.clause_reference?.toLowerCase().includes(q) ?? false)
    );
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.adminDeleteRegulatoryLink(id),
    onSuccess: () => {
      notifications.show({
        title: "Link deleted",
        message: "Regulatory link has been removed",
        color: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-regulatory-clauses"],
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingLink(null);
    setModalOpen(true);
  };

  const openEdit = (link: RegulatoryClauseWithContext) => {
    setEditingLink(link);
    setModalOpen(true);
  };

  const columns = [
    {
      key: "body",
      label: "Body",
      render: (row: RegulatoryClauseWithContext) => (
        <div>
          <Text size="sm" fw={500}>
            {row.body_code}
          </Text>
          <Text size="xs" c="dimmed">
            {row.body_name}
          </Text>
        </div>
      ),
    },
    {
      key: "field",
      label: "Field",
      render: (row: RegulatoryClauseWithContext) => (
        <div>
          <Text size="sm" ff="monospace">
            {row.field_code}
          </Text>
          <Text size="xs" c="dimmed">
            {row.field_name}
          </Text>
        </div>
      ),
    },
    {
      key: "requirement",
      label: "Requirement",
      render: (row: RegulatoryClauseWithContext) => (
        <Badge
          size="sm"
          variant="light"
          color={REQUIREMENT_COLORS[row.requirement_level] ?? "slate"}
        >
          {row.requirement_level}
        </Badge>
      ),
    },
    {
      key: "clause_code",
      label: "Clause Code",
      render: (row: RegulatoryClauseWithContext) => (
        <Text size="xs" ff="monospace">
          {row.clause_code ?? "-"}
        </Text>
      ),
    },
    {
      key: "clause_ref",
      label: "Clause Ref",
      render: (row: RegulatoryClauseWithContext) => (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.clause_reference ?? "-"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: RegulatoryClauseWithContext) => (
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEdit(row)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => deleteMutation.mutate(row.id)}
            loading={deleteMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <TextInput
          placeholder="Search links..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          New Link
        </Button>
      </Group>

      <DataTable<RegulatoryClauseWithContext>
        columns={columns}
        data={filtered}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconLink size={32} />}
        emptyTitle="No regulatory links found"
        emptyDescription={
          debouncedSearch
            ? "Try adjusting your search"
            : "No field-regulatory links configured"
        }
      />

      <LinkModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingLink={editingLink}
      />
    </>
  );
}

// ── Main Component ────────────────────────────────────────

const SUB_TABS = ["bodies", "links"] as const;

export function RegulatoryManagement() {
  const [tab, setTab] = useHashTabs("bodies", [...SUB_TABS], { nested: true });

  return (
    <Tabs value={tab} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value="bodies" leftSection={<IconShield size={14} />}>
          Bodies
        </Tabs.Tab>
        <Tabs.Tab value="links" leftSection={<IconLink size={14} />}>
          Field Links
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="bodies" pt="md">
        <BodiesTab />
      </Tabs.Panel>

      <Tabs.Panel value="links" pt="md">
        <FieldLinksTab />
      </Tabs.Panel>
    </Tabs>
  );
}
