import {
  Alert,
  Badge,
  Button,
  Flex,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { IconCheck, IconRefresh, IconRestore } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";

interface TemplateInfo {
  code: string;
  title: string;
  module_code: string;
  paper_mm: { width: number; height: number };
  has_override: boolean;
  default_html: string;
}

export function DocumentTemplatesPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");
  const [previewNonce, setPreviewNonce] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["render-templates"],
    queryFn: () => api.listRenderTemplates(),
  });
  const templates = data?.templates ?? [];
  const current = templates.find((t) => t.code === selected) ?? null;

  const saveMutation = useMutation({
    mutationFn: (payload: { code: string; html: string | null }) =>
      api.saveRenderTemplate(payload.code, { html: payload.html }),
    onSuccess: () => {
      notifications.show({
        title: "Template saved",
        message: "Preview reflects the saved version.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["render-templates"] });
      setPreviewNonce((n) => n + 1);
    },
    onError: (err: Error) => {
      notifications.show({ title: "Save failed", message: err.message, color: "danger" });
    },
  });

  const openTemplate = (t: TemplateInfo) => {
    setSelected(t.code);
    setHtml(t.default_html);
    setPreviewNonce((n) => n + 1);
  };

  return (
    <div>
      <PageHeader
        title="Document Templates"
        subtitle="Server-rendered PDFs — bills, reports, labels. Edit the HTML body; placeholders bind live data."
      />
      <Flex gap="md" align="flex-start" wrap="wrap">
        <div style={{ flex: "0 0 240px", minWidth: 220 }}>
          <Stack gap="xs">
            {isLoading && <Text c="dimmed">Loading…</Text>}
            {templates.map((t) => (
              <Paper
                key={t.code}
                withBorder
                p="sm"
                style={{ cursor: "pointer" }}
                onClick={() => openTemplate(t)}
                bg={selected === t.code ? "var(--fc-tint, #e4ede9)" : undefined}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={600}>
                      {t.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t.code} · {t.paper_mm.width}×{t.paper_mm.height} mm
                    </Text>
                  </div>
                  {t.has_override && (
                    <Badge size="xs" color="copper" variant="light">
                      custom
                    </Badge>
                  )}
                </Group>
              </Paper>
            ))}
          </Stack>
        </div>
        <div style={{ flex: "1 1 380px", minWidth: 340 }}>
          {current ? (
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={5}>{current.title}</Title>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconRefresh size={14} />}
                    onClick={() => setPreviewNonce((n) => n + 1)}
                  >
                    Refresh preview
                  </Button>
                </Group>
              </Group>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.currentTarget.value)}
                autosize
                minRows={22}
                maxRows={30}
                styles={{ input: { fontFamily: "JetBrains Mono, monospace", fontSize: 11 } }}
                disabled={!canManage}
              />
              <Group justify="space-between">
                <Button
                  size="xs"
                  variant="light"
                  color="danger"
                  leftSection={<IconRestore size={14} />}
                  disabled={!current.has_override || saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ code: current.code, html: null })}
                >
                  Reset to built-in
                </Button>
                <Button
                  size="xs"
                  loading={saveMutation.isPending}
                  disabled={!canManage}
                  onClick={() => saveMutation.mutate({ code: current.code, html })}
                >
                  Save template
                </Button>
              </Group>
              <Alert variant="light" color="primary">
                <Text size="xs">
                  Templates are Tera HTML extending the shared letterhead. Saved versions are
                  validated against the sample data before they can break a render. Placeholders
                  like <code>{"{{ invoice.total_amount }}"}</code> bind live values.
                </Text>
              </Alert>
            </Stack>
          ) : (
            <Text c="dimmed">Select a template to edit.</Text>
          )}
        </div>
        <div style={{ flex: "1 1 420px", minWidth: 360 }}>
          {current ? (
            <ScrollArea h="78vh">
              <iframe
                key={previewNonce}
                title="Template preview"
                src={api.previewRenderTemplateUrl(current.code)}
                style={{ width: "100%", height: "76vh", border: "1px solid #e7ebe8" }}
              />
            </ScrollArea>
          ) : (
            <Text c="dimmed">Live PDF preview appears here.</Text>
          )}
        </div>
      </Flex>
    </div>
  );
}
