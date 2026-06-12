import { Button, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { IconDownload, IconFileTypePdf, IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";

interface DocumentActionsProps {
  /** Built-in template code, e.g. "invoice_gst", "lab_report". */
  templateCode: string;
  /** Source entity id the template binds to (invoice/order/admission…). */
  sourceId: string;
  size?: "xs" | "sm";
  disabled?: boolean;
}

/**
 * Server-rendered PDF actions (epic #267): generate via Gotenberg,
 * open/download through the authenticated documents API, or hand to
 * the print queue. Browser window.print paths remain as fallback.
 */
export function DocumentActions({
  templateCode,
  sourceId,
  size = "xs",
  disabled,
}: DocumentActionsProps) {
  const renderMutation = useMutation({
    mutationFn: () => api.renderDocument({ template_code: templateCode, source_id: sourceId }),
  });

  const generateAndOpen = async () => {
    const result = await renderMutation.mutateAsync();
    window.open(api.downloadDocumentUrl(result.document_output_id), "_blank");
    return result;
  };

  const queuePrint = async () => {
    const result = await renderMutation.mutateAsync();
    await api.queueDocumentPrint(result.document_output_id, { copies: 1 });
    notifications.show({
      title: "Queued for printing",
      message: "The document was handed to the print queue.",
      color: "success",
    });
  };

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size={size}
          variant="light"
          leftSection={<IconFileTypePdf size={14} />}
          loading={renderMutation.isPending}
          disabled={disabled}
        >
          PDF
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconDownload size={14} />}
          onClick={() => {
            void generateAndOpen();
          }}
        >
          Generate & open PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPrinter size={14} />}
          onClick={() => {
            void queuePrint();
          }}
        >
          Send to print queue
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
