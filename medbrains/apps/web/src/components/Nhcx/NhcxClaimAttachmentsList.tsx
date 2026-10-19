import { Anchor, Stack, Text } from "@mantine/core";
import type { NhcxClaimAttachments } from "@medbrains/types";
import { Table } from "@/components/ui";
import { docKindLabel, formatBytes } from "./claimDocuments";
import { NhcxLeftOutList } from "./NhcxLeftOutList";

interface NhcxClaimAttachmentsListProps {
  attachments: NhcxClaimAttachments | null;
}

/** The documents the last final claim carried, and those left out. */
export function NhcxClaimAttachmentsList({ attachments }: NhcxClaimAttachmentsListProps) {
  if (!attachments) return null;
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        Documents sent with the final claim
      </Text>
      {attachments.attached.length === 0 ? (
        <Text size="xs" c="dimmed">
          No documents went with the final claim.
        </Text>
      ) : (
        <Table verticalSpacing={4} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Document</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Size</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {attachments.attached.map((d) => (
              <Table.Tr key={`${d.source}-${d.id}`}>
                <Table.Td>
                  {d.preview_url ? (
                    <Anchor href={d.preview_url} target="_blank" rel="noopener" size="xs">
                      {d.title}
                    </Anchor>
                  ) : (
                    d.title
                  )}
                </Table.Td>
                <Table.Td>{docKindLabel(d.kind)}</Table.Td>
                <Table.Td>{formatBytes(d.size_bytes)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <NhcxLeftOutList items={attachments.left_out} sent />
    </Stack>
  );
}
