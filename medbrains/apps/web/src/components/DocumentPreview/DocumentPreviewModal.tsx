import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconDownload,
  IconPrinter,
  IconBan,
  IconSignature,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import type { DocumentOutput } from "@medbrains/types";
import { useRef } from "react";

interface DocumentPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  // Either provide a documentOutputId (existing doc) or template+context (new doc)
  documentOutputId?: string;
  templateCode?: string;
  context?: Record<string, unknown>;
  title?: string;
  patientId?: string;
  moduleCode?: string;
  sourceTable?: string;
  sourceId?: string;
  visitId?: string;
  admissionId?: string;
}

export function DocumentPreviewModal({
  opened,
  onClose,
  documentOutputId,
  templateCode,
  context,
  title,
  patientId,
  moduleCode,
  sourceTable,
  sourceId,
  visitId,
  admissionId,
}: DocumentPreviewModalProps) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canReprint = useHasPermission(P.DOCUMENTS.REPRINT);
  const canVoid = useHasPermission(P.DOCUMENTS.VOID);

  // Fetch existing document output
  const { data: existingDoc } = useQuery({
    queryKey: ["document-output", documentOutputId],
    queryFn: () => api.getDocumentOutput(documentOutputId as string),
    enabled: !!documentOutputId && opened,
  });

  // Generate new document on demand
  const generateMutation = useMutation({
    mutationFn: () =>
      api.generateDocument({
        template_code: templateCode as string,
        title: title ?? "Document",
        module_code: moduleCode,
        source_table: sourceTable,
        source_id: sourceId,
        patient_id: patientId,
        visit_id: visitId,
        admission_id: admissionId,
        context: context ?? {},
      }),
    onSuccess: (doc: DocumentOutput) => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      notifications.show({
        title: "Document Generated",
        message: `${doc.document_number} created`,
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Generation Failed",
        message: "Could not generate document",
        color: "danger",
      });
    },
  });

  // Record print action
  const printMutation = useMutation({
    mutationFn: (id: string) => api.recordDocumentPrint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      void queryClient.invalidateQueries({ queryKey: ["document-output"] });
    },
  });

  const doc = existingDoc ?? generateMutation.data;

  const handlePrint = () => {
    if (doc) {
      printMutation.mutate(doc.id);
    }
    // Trigger browser print on iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleGenerate = () => {
    if (templateCode && context) {
      generateMutation.mutate();
    }
  };

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      api.voidDocumentOutput(id, { reason: "Voided by user" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      notifications.show({
        title: "Document Voided",
        message: "Document has been voided",
        color: "orange",
      });
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title ?? "Document Preview"}
      size="xl"
      fullScreen
    >
      <Stack gap="md">
        {/* Action bar */}
        <Group justify="space-between">
          <Group gap="xs">
            {doc && (
              <>
                <Badge variant="light">{doc.document_number}</Badge>
                <Badge
                  color={doc.status === "voided" ? "danger" : "success"}
                  variant="light"
                >
                  {doc.status}
                </Badge>
                {doc.print_count > 0 && (
                  <Badge color="slate" variant="light">
                    Printed {doc.print_count}x
                  </Badge>
                )}
                {doc.watermark !== "none" && (
                  <Badge color="orange" variant="light">
                    {doc.watermark}
                  </Badge>
                )}
              </>
            )}
          </Group>
          <Group gap="xs">
            {!doc && templateCode && (
              <Button
                leftSection={<IconPrinter size={16} />}
                onClick={handleGenerate}
                loading={generateMutation.isPending}
              >
                Generate & Print
              </Button>
            )}
            {doc && doc.status !== "voided" && (
              <>
                {canReprint && (
                  <Button
                    leftSection={<IconPrinter size={16} />}
                    onClick={handlePrint}
                    loading={printMutation.isPending}
                  >
                    Print
                  </Button>
                )}
                <ActionIcon variant="light" title="Download" aria-label="Download">
                  <IconDownload size={16} />
                </ActionIcon>
                <ActionIcon variant="light" title="Add Signature" aria-label="Signature">
                  <IconSignature size={16} />
                </ActionIcon>
                {canVoid && (
                  <ActionIcon
                    variant="light"
                    color="danger"
                    title="Void Document"
                    onClick={() => voidMutation.mutate(doc.id)}
                    loading={voidMutation.isPending}
                    aria-label="Block"
                  >
                    <IconBan size={16} />
                  </ActionIcon>
                )}
              </>
            )}
          </Group>
        </Group>

        {/* Document content area */}
        {generateMutation.isPending && (
          <Stack align="center" py="xl">
            <Loader size="lg" />
            <Text c="dimmed">Generating document...</Text>
          </Stack>
        )}

        {doc && doc.context_snapshot && (
          <div
            style={{
              border: "1px solid var(--mantine-color-gray-3)",
              borderRadius: 8,
              padding: 16,
              minHeight: 600,
              background: "white",
            }}
          >
            <Text c="dimmed" ta="center" py="xl">
              Document preview will render here using the template layout and context data.
              <br />
              Print via browser print dialog for now (Phase 1).
            </Text>
          </div>
        )}

        {!doc && !generateMutation.isPending && !templateCode && (
          <Text c="dimmed" ta="center" py="xl">
            No document to preview
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
