import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type FormTemplateListItem, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { FormEditorDrawer } from "./FormEditorDrawer";
import { NewFormModal } from "./NewFormModal";

const STATUS: Record<FormTemplateListItem["status"], { label: string; tone: BadgeTone }> = {
  built_in: { label: "Built in", tone: "neutral" },
  draft: { label: "Draft", tone: "warning" },
  published: { label: "Published", tone: "success" },
  retired: { label: "Retired", tone: "neutral" },
};

/** The hospital's own forms: build one, or customise a built-in one, and publish it. */
export function FormTemplatesPage() {
  useRequirePermission(P.FORMS.TEMPLATES.LIST);
  const canManage = useHasPermission(P.FORMS.TEMPLATES.MANAGE);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ["form-templates"], queryFn: () => api.listFormTemplates() });

  const customise = useMutation({
    mutationFn: (item: FormTemplateListItem) =>
      api.createFormTemplate({ code: item.code, name: item.name, module: item.module }),
    onSuccess: (template) => {
      void queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      setEditing(template.id);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Couldn't start customising" }),
  });

  const columns = [
    {
      key: "name",
      label: "Form",
      render: (row: FormTemplateListItem) => <Text fw={500}>{row.name}</Text>,
    },
    { key: "module", label: "Module", render: (row: FormTemplateListItem) => row.module },
    {
      key: "status",
      label: "Status",
      render: (row: FormTemplateListItem) => (
        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
      ),
    },
    {
      key: "version",
      label: "Live version",
      render: (row: FormTemplateListItem) =>
        row.published_version
          ? `v${row.published_version}`
          : row.built_in
            ? "Built-in"
            : "None yet",
    },
    {
      key: "actions",
      label: "",
      render: (row: FormTemplateListItem) =>
        row.id ? (
          <Button tone="ghost" size="xs" onClick={() => setEditing(row.id)}>
            {canManage ? "Edit" : "View"}
          </Button>
        ) : (
          canManage && (
            <Button
              tone="ghost"
              size="xs"
              loading={customise.isPending}
              onClick={() => customise.mutate(row)}
            >
              Customise
            </Button>
          )
        ),
    },
  ];

  return (
    <Stack gap="md" p="md">
      <PageHeader
        title="Forms"
        subtitle="Forms staff fill in. Edit a draft, publish it, and every record keeps the version it was taken on."
        actions={
          canManage ? (
            <Group>
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => setCreating(true)}
              >
                New form
              </Button>
            </Group>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={list.data ?? []}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        rowKey={(row) => row.id ?? row.code}
        emptyTitle="No forms yet"
      />
      <NewFormModal
        opened={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setEditing(id);
        }}
      />
      <FormEditorDrawer templateId={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}
