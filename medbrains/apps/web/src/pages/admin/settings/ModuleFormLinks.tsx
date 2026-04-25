import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NavLink,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconApps,
  IconLink,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  CreateModuleLinkRequest,
  FormMaster,
  ModuleConfig,
  ModuleFormLinkRow,
} from "@medbrains/types";

function LinkFormModal({
  opened,
  onClose,
  selectedModule,
  forms,
}: {
  opened: boolean;
  onClose: () => void;
  selectedModule: string | null;
  forms: FormMaster[];
}) {
  const queryClient = useQueryClient();
  const [formId, setFormId] = useState<string | null>(null);
  const [context, setContext] = useState("primary");

  const handleOpen = () => {
    setFormId(null);
    setContext("primary");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateModuleLinkRequest) =>
      api.adminCreateModuleLink(data),
    onSuccess: () => {
      notifications.show({
        title: "Link created",
        message: "Form linked to module",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-module-links"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Link failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!formId || !selectedModule) return;
    createMutation.mutate({
      module_code: selectedModule,
      form_id: formId,
      context: context || "primary",
    });
  };

  const formOptions = forms.map((f) => ({
    value: f.id,
    label: `${f.name} (${f.code})`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Link Form to Module"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Module"
          value={selectedModule ?? ""}
          disabled
        />
        <Select
          label="Form"
          placeholder="Select a form"
          data={formOptions}
          value={formId}
          onChange={setFormId}
          searchable
          required
        />
        <TextInput
          label="Context"
          placeholder="primary"
          value={context}
          onChange={(e) => setContext(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!formId}
          >
            Link
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ModuleFormLinks() {
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: () => api.listModules(),
  });

  const { data: allLinks } = useQuery({
    queryKey: ["admin-module-links"],
    queryFn: () => api.adminListModuleLinks(),
  });

  const { data: forms } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => api.adminListForms(),
  });

  const deleteMutation = useMutation({
    mutationFn: (link: ModuleFormLinkRow) =>
      api.adminDeleteModuleLink(link.module_code, link.form_id, link.context),
    onSuccess: () => {
      notifications.show({
        title: "Link removed",
        message: "Form unlinked from module",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-module-links"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Unlink failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const enabledModules = (modules ?? []).filter(
    (m: ModuleConfig) => m.status === "enabled",
  );

  const moduleLinks = (allLinks ?? []).filter(
    (l: ModuleFormLinkRow) => l.module_code === selectedModule,
  );

  // Count links per module for badges
  const linkCounts: Record<string, number> = {};
  for (const link of allLinks ?? []) {
    linkCounts[link.module_code] = (linkCounts[link.module_code] ?? 0) + 1;
  }

  return (
    <Grid>
      <Grid.Col span={4}>
        <Card withBorder padding="xs">
          <Text size="sm" fw={600} mb="xs">
            Modules
          </Text>
          {enabledModules.length === 0 && (
            <Text size="sm" c="dimmed">
              No enabled modules.
            </Text>
          )}
          {enabledModules.map((mod: ModuleConfig) => (
            <NavLink
              key={mod.code}
              label={mod.name}
              description={mod.code}
              active={selectedModule === mod.code}
              onClick={() => setSelectedModule(mod.code)}
              rightSection={
                linkCounts[mod.code] ? (
                  <Badge size="xs" variant="light">
                    {linkCounts[mod.code]}
                  </Badge>
                ) : undefined
              }
              leftSection={<IconApps size={16} />}
            />
          ))}
        </Card>
      </Grid.Col>

      <Grid.Col span={8}>
        {!selectedModule ? (
          <Box pt="xl" ta="center">
            <IconLink size={32} color="var(--mantine-color-gray-5)" />
            <Text c="dimmed" mt="sm">
              Select a module to view linked forms
            </Text>
          </Box>
        ) : (
          <>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Forms linked to{" "}
                <Text span ff="monospace">
                  {selectedModule}
                </Text>
              </Text>
              <Button
                size="sm"
                leftSection={<IconPlus size={14} />}
                onClick={() => setLinkModalOpen(true)}
              >
                Link Form
              </Button>
            </Group>

            {moduleLinks.length === 0 ? (
              <Text size="sm" c="dimmed">
                No forms linked to this module.
              </Text>
            ) : (
              <Stack gap="xs">
                {moduleLinks.map((link: ModuleFormLinkRow) => (
                  <Card
                    key={`${link.form_id}-${link.context}`}
                    withBorder
                    padding="sm"
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text size="sm" fw={500}>
                          {link.form_name}
                        </Text>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed" ff="monospace">
                            {link.form_code}
                          </Text>
                          <Badge size="xs" variant="light">
                            {link.context}
                          </Badge>
                        </Group>
                      </Box>
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        onClick={() => deleteMutation.mutate(link)}
                        loading={deleteMutation.isPending}
                        aria-label="Delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}

            <LinkFormModal
              opened={linkModalOpen}
              onClose={() => setLinkModalOpen(false)}
              selectedModule={selectedModule}
              forms={forms ?? []}
            />
          </>
        )}
      </Grid.Col>
    </Grid>
  );
}
