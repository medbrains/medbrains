/**
 * On a radiology order: the PC-PNDT Form F the scan needs, and whether it is
 * complete — the report cannot be verified until it is. Completed and printed
 * from here, where the radiologist already is.
 */
import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PcpndtForm } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PrintDocumentButton } from "@/components/Print/PrintDocumentButton";
import { Alert, Button } from "@/components/ui";
import { CompleteFormFDrawer } from "@/pages/regulatory/complete-form-f-drawer";
import { regulatoryService } from "@/services/regulatory.service";

export function OrderFormFNotice({ orderId }: { orderId: string }) {
  const canSee = useHasPermission(P.REGULATORY.PCPNDT_LIST);
  const canComplete = useHasPermission(P.REGULATORY.PCPNDT_CREATE);
  const [completing, setCompleting] = useState<PcpndtForm | null>(null);
  const forms = useQuery({
    queryKey: ["form-f-for-order", orderId],
    queryFn: () => regulatoryService.listPcpndtForms({ radiology_order_id: orderId }),
    enabled: canSee,
  });
  if (forms.isError) {
    return (
      <Alert tone="warning">
        Could not check this scan's PC-PNDT Form F: {forms.error.message}
      </Alert>
    );
  }
  const form = forms.data?.[0];
  if (!form) return null;
  const done = Boolean(form.woman_declared_at && form.doctor_declared_at);
  return (
    <Alert
      tone={done ? "success" : "warning"}
      title={`PC-PNDT Form F ${form.form_number}`}
      data-testid="order-form-f"
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          {done
            ? "Complete, with both declarations."
            : "Required for this scan. Complete it before the report is verified."}
        </Text>
        <Group gap="xs" wrap="nowrap">
          {!done && canComplete && (
            <Button size="xs" tone="primary" onClick={() => setCompleting(form)}>
              Complete Form F
            </Button>
          )}
          <PrintDocumentButton documentKey="pcpndt-form-f" recordId={form.id} />
        </Group>
      </Group>
      <CompleteFormFDrawer form={completing} onClose={() => setCompleting(null)} />
    </Alert>
  );
}
