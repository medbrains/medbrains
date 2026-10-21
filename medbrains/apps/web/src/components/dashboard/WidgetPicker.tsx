import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { DashboardWidget, WidgetTemplate } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Checkbox, Input, Modal } from "@/components/ui";

interface WidgetPickerProps {
  opened: boolean;
  onClose: () => void;
  /** The widgets on the viewer's dashboard now (only visible ones are sent). */
  widgets: DashboardWidget[];
}

/**
 * The widget menu: every catalogue widget the viewer may place, grouped by
 * area, each with a checkbox for "on my dashboard". The server offers only
 * what the viewer's permissions allow, and copies the widget itself — the
 * menu sends a code and a yes/no, nothing else.
 */
export function WidgetPicker({ opened, onClose, widgets }: WidgetPickerProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // What the viewer just clicked, until the dashboard reloads with it saved.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const templates = useQuery({
    queryKey: ["widget-templates"],
    queryFn: () => api.listWidgetTemplates(),
    enabled: opened,
    staleTime: 300_000,
  });
  const shown = useMemo(
    () => new Set(widgets.flatMap((w) => (w.template_code ? [w.template_code] : []))),
    [widgets],
  );
  const groups = useMemo(
    () => groupByCategory(templates.data ?? [], search),
    [templates.data, search],
  );
  const toggle = useMutation({
    mutationFn: ({ code, visible }: { code: string; visible: boolean }) =>
      api.setMyWidget(code, visible),
    onMutate: ({ code, visible }) => setPending((p) => ({ ...p, [code]: visible })),
    onSettled: async (_data, _error, { code }) => {
      await queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
      setPending(({ [code]: _done, ...rest }) => rest);
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Widgets" size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Choose what your dashboard shows. Only widgets your access allows are listed.
        </Text>
        <Input
          label="Find a widget"
          placeholder="Wait time, revenue, occupancy…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        {templates.isError && (
          <Alert tone="danger" title="The widget list could not be loaded">
            Close this and try again.
          </Alert>
        )}
        {toggle.isError && (
          <Alert tone="danger" title="That change was not saved">
            Your dashboard is as it was. Try again.
          </Alert>
        )}
        {groups.map(([category, items]) => (
          <Stack key={category} gap={6} role="group" aria-label={category}>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              {category}
            </Text>
            {items.map((t) => (
              <Checkbox
                key={t.code}
                label={t.name}
                description={t.description ?? undefined}
                checked={pending[t.code ?? ""] ?? shown.has(t.code ?? "")}
                onChange={(e) =>
                  t.code && toggle.mutate({ code: t.code, visible: e.currentTarget.checked })
                }
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Modal>
  );
}

/** Coded templates matching the search, grouped by category in catalogue order. */
function groupByCategory(
  templates: WidgetTemplate[],
  search: string,
): [string, WidgetTemplate[]][] {
  const q = search.trim().toLowerCase();
  const groups = new Map<string, WidgetTemplate[]>();
  for (const t of templates) {
    if (!t.code) continue;
    const text = `${t.name} ${t.description ?? ""} ${t.category}`.toLowerCase();
    if (q && !text.includes(q)) continue;
    groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  }
  return [...groups.entries()];
}
