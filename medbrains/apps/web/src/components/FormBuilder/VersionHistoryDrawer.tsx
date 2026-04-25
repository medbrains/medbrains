import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconClock,
  IconEye,
  IconGitCompare,
  IconRestore,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { FormVersionSummary } from "@medbrains/types";
import { VersionDiffView } from "./VersionDiffView";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const statusColors: Record<string, string> = {
  draft: "slate",
  active: "success",
  deprecated: "orange",
};

interface Props {
  formId: string;
  currentVersion: number;
  opened: boolean;
  onClose: () => void;
}

export function VersionHistoryDrawer({
  formId,
  currentVersion,
  opened,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [diffOpened, diffHandlers] = useDisclosure(false);
  const [diffV1, setDiffV1] = useState(0);
  const [diffV2, setDiffV2] = useState(0);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<FormVersionSummary | null>(null);

  const { data: versions } = useQuery({
    queryKey: ["form-versions", formId],
    queryFn: () => api.adminListFormVersions(formId),
    enabled: opened,
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      api.adminRestoreFormVersion(formId, version),
    onSuccess: () => {
      notifications.show({
        title: "Version restored",
        message: "Form has been restored to the selected version as a new draft.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      void queryClient.invalidateQueries({ queryKey: ["form-versions", formId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-form-detail"] });
      setRestoreVersion(null);
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Restore failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCompare = (v: number) => {
    setDiffV1(v);
    setDiffV2(0); // 0 = current live state
    diffHandlers.open();
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title="Version History"
        position="right"
        size="md"
        padding="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Current: v{currentVersion}
          </Text>

          {versions && versions.length === 0 && (
            <Text size="sm" c="dimmed">
              No published versions yet. Publish the form to create the first
              version.
            </Text>
          )}

          {versions && versions.length > 0 && (
            <Timeline active={0} bulletSize={24} lineWidth={2}>
              {versions.map((v) => (
                <Timeline.Item
                  key={v.id}
                  bullet={<IconClock size={14} />}
                  title={
                    <Group gap="xs">
                      <Badge size="sm" variant="filled" color="primary">
                        v{v.version}
                      </Badge>
                      <Badge
                        size="xs"
                        variant="light"
                        color={statusColors[v.status] ?? "slate"}
                      >
                        {v.status}
                      </Badge>
                    </Group>
                  }
                >
                  <Stack gap={4} mt={4}>
                    {v.change_summary && (
                      <Text size="sm">{v.change_summary}</Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {v.created_by_name ?? "System"} &middot;{" "}
                      {timeAgo(v.created_at)}
                    </Text>
                    <Group gap={4} mt={4}>
                      <Tooltip label="Preview">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => setPreviewVersion(v)}
                          aria-label="View details"
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Compare with current">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="primary"
                          onClick={() => openCompare(v.version)}
                          aria-label="Git Compare"
                        >
                          <IconGitCompare size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Restore this version">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="orange"
                          onClick={() => setRestoreVersion(v.version)}
                          aria-label="Restore"
                        >
                          <IconRestore size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Stack>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Stack>
      </Drawer>

      {/* Preview Modal */}
      <Modal
        opened={!!previewVersion}
        onClose={() => setPreviewVersion(null)}
        title={`Version ${previewVersion?.version} Preview`}
        size="lg"
      >
        {previewVersion && (
          <Stack gap="sm">
            <Group>
              <Badge color="primary">v{previewVersion.version}</Badge>
              <Badge
                color={statusColors[previewVersion.status] ?? "slate"}
                variant="light"
              >
                {previewVersion.status}
              </Badge>
            </Group>
            <Text size="sm" fw={500}>
              {previewVersion.name}
            </Text>
            {previewVersion.change_summary && (
              <Textarea
                label="Change Summary"
                value={previewVersion.change_summary}
                readOnly
                minRows={2}
              />
            )}
            <Text size="xs" c="dimmed">
              Published by {previewVersion.created_by_name ?? "System"} on{" "}
              {new Date(previewVersion.created_at).toLocaleString()}
            </Text>
          </Stack>
        )}
      </Modal>

      {/* Restore Confirm */}
      <Modal
        opened={restoreVersion !== null}
        onClose={() => setRestoreVersion(null)}
        title="Restore Version"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            This will create a new draft version (v
            {currentVersion + 1}) with the contents from v{restoreVersion}. The
            current state will be preserved in version history.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => setRestoreVersion(null)}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              loading={restoreMutation.isPending}
              onClick={() => {
                if (restoreVersion !== null) {
                  restoreMutation.mutate(restoreVersion);
                }
              }}
            >
              Restore
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Diff View */}
      <VersionDiffView
        formId={formId}
        v1={diffV1}
        v2={diffV2}
        opened={diffOpened}
        onClose={diffHandlers.close}
      />
    </>
  );
}
