import { Anchor, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxPreparedClaimDocuments, PatientDocument } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconExternalLink, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Badge, Checkbox, IconButton, Select } from "@/components/ui";
import { docKey, docKindLabel, formatBytes, picksTotalBytes } from "./claimDocuments";
import { NhcxLeftOutList } from "./NhcxLeftOutList";

interface NhcxClaimDocumentsPickerProps {
  prepared: NhcxPreparedClaimDocuments;
  unticked: ReadonlySet<string>;
  onToggle: (key: string) => void;
  added: PatientDocument[];
  onAdd: (doc: PatientDocument) => void;
  onRemove: (id: string) => void;
}

/**
 * The documents a final claim will carry — each with a tick, its size and a
 * preview — what was left out and why, and a picker for the patient's other
 * stored documents.
 */
export function NhcxClaimDocumentsPicker({
  prepared,
  unticked,
  onToggle,
  added,
  onAdd,
  onRemove,
}: NhcxClaimDocumentsPickerProps) {
  const canReadPatientDocs = useHasPermission(P.PATIENTS.VIEW);
  const stored = useQuery({
    queryKey: ["patient-documents", prepared.patient_id],
    queryFn: () => api.listPatientDocuments(prepared.patient_id),
    enabled: canReadPatientDocs,
  });
  const options = useMemo(() => {
    const taken = new Set(added.map((d) => d.id));
    return (stored.data ?? [])
      .filter((d) => !taken.has(d.id))
      .map((d) => ({ value: d.id, label: `${d.document_name} · ${formatBytes(d.file_size)}` }));
  }, [stored.data, added]);
  const total = picksTotalBytes(prepared.documents, unticked, added);
  const overTotal = total > prepared.max_total_bytes;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Documents sent with the claim
      </Text>
      {prepared.documents.map((d) => (
        <Group key={docKey(d)} justify="space-between" wrap="nowrap">
          <Checkbox
            checked={!unticked.has(docKey(d))}
            onChange={() => onToggle(docKey(d))}
            disabled={d.kind === "discharge_summary"}
            label={`${d.title} · ${formatBytes(d.size_bytes)}`}
            description={
              d.kind === "discharge_summary" ? "Always sent with a stay's final claim" : undefined
            }
          />
          <Group gap="xs" wrap="nowrap">
            <Badge size="xs" tone="neutral">
              {docKindLabel(d.kind)}
            </Badge>
            {d.preview_url && (
              <Anchor href={d.preview_url} target="_blank" rel="noopener" size="xs">
                <Group gap={4} wrap="nowrap">
                  <IconExternalLink size={16} aria-hidden />
                  Preview
                </Group>
              </Anchor>
            )}
          </Group>
        </Group>
      ))}
      {added.map((d) => (
        <Group key={d.id} justify="space-between" wrap="nowrap">
          <Text size="sm">
            {d.document_name} · {formatBytes(d.file_size)}
          </Text>
          <IconButton
            aria-label={`Remove ${d.document_name}`}
            tone="default"
            onClick={() => onRemove(d.id)}
          >
            <IconX size={16} />
          </IconButton>
        </Group>
      ))}
      {canReadPatientDocs && (
        <Select
          label="Add a stored patient document"
          placeholder={stored.isLoading ? "Loading documents…" : "Search the patient's documents"}
          data={options}
          value={null}
          searchable
          nothingFoundMessage={stored.isError ? "Could not load the documents" : "None left to add"}
          onChange={(id) => {
            const doc = stored.data?.find((x) => x.id === id);
            if (doc) onAdd(doc);
          }}
        />
      )}
      <Text size="xs" c="dimmed">
        {formatBytes(total)} of {formatBytes(prepared.max_total_bytes)} allowed; one file up to{" "}
        {formatBytes(prepared.max_file_bytes)}.
      </Text>
      {overTotal && (
        <Alert tone="warning" title="Over the size limit">
          The least-needed documents will be left out to fit — untick some to choose which.
        </Alert>
      )}
      <NhcxLeftOutList items={prepared.left_out} />
    </Stack>
  );
}
