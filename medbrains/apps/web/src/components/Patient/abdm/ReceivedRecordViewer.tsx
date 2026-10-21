import { Anchor, List, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Modal, Panel } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { HI_TYPE_LABEL } from "./abdmStatus";
import { readDocument } from "./fhirSections";

interface Props {
  recordId: string | null;
  onClose: () => void;
}

/** One record another hospital sent, read into sections, while it may be held. */
export function ReceivedRecordViewer({ recordId, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["abdm", "received-record", recordId],
    queryFn: () => abdmRecordsService.receivedRecord(recordId ?? ""),
    enabled: recordId !== null,
    retry: false,
  });
  const doc = useMemo(() => (data ? readDocument(data.bundle) : null), [data]);

  return (
    <Modal
      opened={recordId !== null}
      onClose={onClose}
      title="Record from another hospital"
      fullScreen
    >
      {isLoading && <Loader size="sm" />}
      {isError && (
        <Alert tone="warning" title="This record is not available">
          The consent may have been withdrawn or expired, and the copy erased.
        </Alert>
      )}
      {data && doc && (
        <Stack gap="md">
          <Stack gap={0}>
            <Text fw={600}>
              {doc.title ?? (data.hi_type ? HI_TYPE_LABEL[data.hi_type] : "Record")}
            </Text>
            <Text size="sm" c="dimmed">
              {data.source_hip_name ?? data.source_hip_id} ·{" "}
              {formatDate(doc.date ?? data.received_at)}
              {doc.author ? ` · ${doc.author}` : ""}
            </Text>
            <Text size="xs" c="dimmed">
              Shared through ABDM with the patient's consent; erased by {formatDate(data.erase_at)}.
            </Text>
          </Stack>
          {doc.sections.length === 0 && (
            <Text size="sm" c="dimmed">
              This record has no sections this screen can read.
            </Text>
          )}
          {doc.sections.map((s) => (
            <Panel key={s.title} title={s.title} bare>
              <List spacing={4} size="sm">
                {s.items.map((item) => (
                  <List.Item key={item.key}>
                    <Text size="sm">{item.text}</Text>
                    {item.detail && (
                      <Text size="xs" c="dimmed">
                        {item.detail}
                      </Text>
                    )}
                    {item.link && (
                      <Anchor
                        size="sm"
                        href={item.link.href}
                        download={item.link.download}
                        target={item.link.download ? undefined : "_blank"}
                        rel="noopener noreferrer"
                      >
                        {item.link.label}
                      </Anchor>
                    )}
                  </List.Item>
                ))}
              </List>
            </Panel>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
