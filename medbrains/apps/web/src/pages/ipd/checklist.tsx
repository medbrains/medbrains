// IPD ChecklistTab — split from ipd.tsx (pure move).

import { Checkbox, Group, Menu, Progress, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { AdmissionChecklist } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import type { ChecklistTemplate } from "@/data/checklist-templates";
import { ALL_TEMPLATES } from "@/data/checklist-templates";
import { ipdService } from "@/services/ipd.service";

export function ChecklistTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["ipd-checklist", admissionId],
    queryFn: () => ipdService.listAdmissionChecklist(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      ipdService.createAdmissionChecklist(admissionId, {
        items: [{ item_label: newLabel, category: newCategory || undefined }],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
      toast.success("Checklist item added", { title: "Added" });
      setNewLabel("");
      setNewCategory("");
    },
  });

  const seedTemplateMutation = useMutation({
    mutationFn: (template: ChecklistTemplate) =>
      ipdService.createAdmissionChecklist(admissionId, { items: template.items }),
    onSuccess: (_data, template) => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
      toast.success(`${template.title} — ${template.items.length} items added`, {
        title: "Template loaded",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      ipdService.toggleChecklistItem(admissionId, itemId, { is_completed: completed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-checklist", admissionId] });
    },
  });

  const rows = items ?? [];
  const completed = rows.filter((r: AdmissionChecklist) => r.is_completed).length;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={500}>
          Checklist ({completed}/{rows.length} completed)
        </Text>
        {rows.length > 0 && (
          <Progress
            value={rows.length > 0 ? (completed / rows.length) * 100 : 0}
            size="lg"
            w={200}
          />
        )}
      </Group>

      {canCreate && (
        <Stack gap="xs">
          <Group>
            <TextInput
              placeholder="Item label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.currentTarget.value)}
              w={150}
            />
            <Button
              tone="primary"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!newLabel}
              loading={createMutation.isPending}
            >
              Add
            </Button>
            <Menu shadow="md" position="bottom-end">
              <Menu.Target>
                <Button
                  tone="secondary"
                  size="sm"
                  loading={seedTemplateMutation.isPending}
                  leftSection={<IconPlus size={14} />}
                >
                  Load template
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Seed standard checklist</Menu.Label>
                {ALL_TEMPLATES.map((template) => (
                  <Menu.Item
                    key={template.key}
                    onClick={() => seedTemplateMutation.mutate(template)}
                  >
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {template.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {template.description}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Stack>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No checklist items yet. Add items to track admission readiness.
        </Text>
      ) : (
        <Stack gap="xs">
          {rows.map((item: AdmissionChecklist) => (
            <Group
              key={item.id}
              p="xs"
              style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
            >
              <Checkbox
                checked={item.is_completed}
                onChange={(e) =>
                  toggleMutation.mutate({ itemId: item.id, completed: e.currentTarget.checked })
                }
              />
              <div style={{ flex: 1 }}>
                <Text size="sm" td={item.is_completed ? "line-through" : undefined}>
                  {item.item_label}
                </Text>
                {item.category && (
                  <Text size="xs" c="dimmed">
                    {item.category}
                  </Text>
                )}
              </div>
              {item.completed_at && (
                <Text size="xs" c="dimmed">
                  {new Date(item.completed_at).toLocaleString()}
                </Text>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Transfer Log (history)
// ══════════════════════════════════════════════════════════
