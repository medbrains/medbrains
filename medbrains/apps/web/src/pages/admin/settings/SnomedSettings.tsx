/**
 * Settings → SNOMED CT: load licensed RF2 release packages and watch them
 * import. The International Edition and each NRCeS India extension is its
 * own release; loading the same one twice is a no-op.
 */
import { FileInput, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type SnomedRelease, type SnomedReleaseStatus } from "@medbrains/types";
import { IconFileZip, IconServer, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { SnomedLicenceNotice } from "@/components/Clinical/SnomedLicenceNotice";
import { Alert, Badge, type BadgeTone, Button, Card, toast } from "@/components/ui";
import { snomedService } from "@/services/snomed.service";

const STATUS: Record<SnomedReleaseStatus, { tone: BadgeTone; label: string }> = {
  queued: { tone: "info", label: "Queued" },
  importing: { tone: "info", label: "Importing" },
  closure: { tone: "info", label: "Building hierarchy" },
  completed: { tone: "success", label: "Loaded" },
  failed: { tone: "danger", label: "Failed" },
};
const ACTIVE = new Set<SnomedReleaseStatus>(["queued", "importing", "closure"]);
const POLL_MS = 2000;
const RELEASES_KEY = ["snomed-releases"];

function formatCount(n: number) {
  return n.toLocaleString();
}

export function SnomedSettings() {
  const canManage = useHasPermission(P.TERMINOLOGY.SNOMED.MANAGE);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const releases = useQuery({
    queryKey: RELEASES_KEY,
    queryFn: snomedService.listReleases,
    enabled: canManage,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => ACTIVE.has(r.status)) ? POLL_MS : false,
  });
  const importFiles = useQuery({
    queryKey: ["snomed-import-files"],
    queryFn: snomedService.listImportFiles,
    enabled: canManage,
  });

  const onStarted = (started: { already_imported: boolean; release: SnomedRelease }) => {
    setFile(null);
    void qc.invalidateQueries({ queryKey: RELEASES_KEY });
    void qc.invalidateQueries({ queryKey: ["snomed-status"] });
    const name = `${started.release.edition} ${started.release.version_date}`;
    if (started.already_imported) toast.info(`${name} is already loaded — nothing to do`);
    else toast.success(`${name} is importing`);
  };
  const upload = useMutation({ mutationFn: snomedService.uploadRelease, onSuccess: onStarted });
  const fromPath = useMutation({ mutationFn: snomedService.importFromPath, onSuccess: onStarted });
  const busy = (releases.data ?? []).some((r) => ACTIVE.has(r.status));

  return (
    <Stack gap="md">
      <SnomedLicenceNotice />
      {canManage && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>Upload a release package</Text>
              <Text size="sm" c="dimmed">
                The RF2 zip from SNOMED International or NRCeS. Only the Snapshot files are loaded.
              </Text>
              <FileInput
                label="Release zip"
                accept=".zip,application/zip"
                leftSection={<IconFileZip size={16} />}
                value={file}
                onChange={setFile}
                clearable
              />
              <Group justify="flex-end">
                <Button
                  tone="primary"
                  leftSection={<IconUpload size={16} />}
                  disabled={!file || busy}
                  loading={upload.isPending}
                  onClick={() => file && upload.mutate(file)}
                >
                  Upload and import
                </Button>
              </Group>
              {upload.error && <Alert tone="danger">{upload.error.message}</Alert>}
            </Stack>
          </Card>
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>From the server's import directory</Text>
              {importFiles.isError ? (
                <Text size="sm">Could not read the import directory.</Text>
              ) : !importFiles.data?.directory_configured ? (
                <Text size="sm" c="dimmed">
                  For packages too large to upload, set SNOMED_IMPORT_DIR on the server and place
                  the zip there.
                </Text>
              ) : importFiles.data.files.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No .zip files in the import directory.
                </Text>
              ) : (
                importFiles.data.files.map((f) => (
                  <Group key={f.file_name} justify="space-between" wrap="nowrap">
                    <Text size="sm" ff="monospace" truncate>
                      {f.file_name} · {(f.size_bytes / (1024 * 1024)).toFixed(0)} MB
                    </Text>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconServer size={14} />}
                      disabled={busy}
                      loading={fromPath.isPending && fromPath.variables === f.file_name}
                      onClick={() => fromPath.mutate(f.file_name)}
                    >
                      Import
                    </Button>
                  </Group>
                ))
              )}
              {fromPath.error && <Alert tone="danger">{fromPath.error.message}</Alert>}
            </Stack>
          </Card>
        </SimpleGrid>
      )}
      <DataTable
        data={releases.data ?? []}
        loading={releases.isLoading}
        error={releases.error}
        onRetry={() => void releases.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No SNOMED CT release loaded"
        emptyDescription="Upload the release when the licence is approved."
        columns={[
          {
            key: "release",
            label: "Release",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {r.edition} · {r.version_date}
                </Text>
                <Text size="xs" c="dimmed">
                  {r.file_name ?? r.source}
                </Text>
              </Stack>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Stack gap={2}>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                {ACTIVE.has(r.status) && (
                  <Text size="xs" c="dimmed">
                    {r.phase ?? "Waiting"} · {formatCount(r.rows_processed)} rows
                  </Text>
                )}
                {r.status === "failed" && r.error && <Text size="xs">{r.error}</Text>}
              </Stack>
            ),
          },
          {
            key: "content",
            label: "Content",
            render: (r) =>
              r.status === "completed" ? (
                <Text size="xs">
                  {formatCount(r.concept_count)} concepts · {formatCount(r.description_count)}{" "}
                  descriptions · {formatCount(r.relationship_count)} relationships ·{" "}
                  {formatCount(r.refset_member_count)} refset members
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "by",
            label: "Loaded by",
            render: (r) => (
              <Text size="xs">
                {r.imported_by_name ?? "—"}
                {r.imported_at ? ` · ${new Date(r.imported_at).toLocaleString()}` : ""}
              </Text>
            ),
          },
        ]}
      />
    </Stack>
  );
}
