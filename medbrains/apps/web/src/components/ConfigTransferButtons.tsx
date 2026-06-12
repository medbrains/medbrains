import { Badge, Button, FileButton, Group, List, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

interface ImportPreview {
  bundle: unknown;
  changes: { kind: string; item: string; action: string }[];
}

/**
 * Tenant configuration export/import (audit #210): download the
 * settings + template bundle as JSON; importing always dry-runs first
 * and shows the diff before anything is applied.
 */
export function ConfigTransferButtons() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const exportMutation = useMutation({
    mutationFn: () => api.exportTenantConfig(),
    onSuccess: (bundle) => {
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medbrains-config-${bundle.exported_at.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: async (file: File) => {
      const bundle = JSON.parse(await file.text());
      const result = await api.importTenantConfig({ bundle, dry_run: true });
      return { bundle, changes: result.changes };
    },
    onSuccess: (result) => {
      if (result.changes.length === 0) {
        notifications.show({
          title: "No changes",
          message: "This bundle matches the current configuration.",
          color: "primary",
        });
        return;
      }
      setPreview(result);
    },
  });

  const applyMutation = useMutation({
    mutationFn: (bundle: unknown) => api.importTenantConfig({ bundle, dry_run: false }),
    onSuccess: (result) => {
      notifications.show({
        title: "Configuration imported",
        message: `${result.total_changes} change(s) applied.`,
        color: "success",
      });
      setPreview(null);
    },
  });

  return (
    <>
      <Group gap="xs">
        <Button
          size="xs"
          variant="light"
          leftSection={<IconDownload size={14} />}
          loading={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          Export config
        </Button>
        <FileButton onChange={(file) => file && dryRunMutation.mutate(file)} accept=".json">
          {(props) => (
            <Button
              {...props}
              size="xs"
              variant="light"
              leftSection={<IconUpload size={14} />}
              loading={dryRunMutation.isPending}
            >
              Import config
            </Button>
          )}
        </FileButton>
      </Group>

      <Modal
        opened={preview !== null}
        onClose={() => setPreview(null)}
        title="Import preview"
        size="lg"
      >
        {preview && (
          <Stack gap="sm">
            <Text size="sm">
              {preview.changes.length} change(s) will be applied. Nothing has been written yet.
            </Text>
            <List size="sm" spacing={4}>
              {preview.changes.slice(0, 50).map((change) => (
                <List.Item key={`${change.kind}:${change.item}`}>
                  <Badge
                    size="xs"
                    variant="light"
                    color={change.action === "create" ? "success" : "warning"}
                    mr={6}
                  >
                    {change.action}
                  </Badge>
                  <Text span size="sm" ff="monospace">
                    {change.kind}: {change.item}
                  </Text>
                </List.Item>
              ))}
              {preview.changes.length > 50 && (
                <List.Item>…and {preview.changes.length - 50} more</List.Item>
              )}
            </List>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                loading={applyMutation.isPending}
                onClick={() => applyMutation.mutate(preview.bundle)}
              >
                Apply {preview.changes.length} change(s)
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
