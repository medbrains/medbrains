import { Group, Select as MantineSelect, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { CreateReportDispatchRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconSend } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { safeReturnPath } from "@/lib/return-path";
import { labService } from "@/services/lab.service";
import { LAB_DISPATCH_METHOD_OPTIONS } from "./shared";

/**
 * Recording that a report was handed over, and to whom.
 *
 * The drawer this replaces asked a clerk to type two UUIDs — the order and
 * the patient — into plain text boxes. Nobody knows their own patient's UUID,
 * so in practice they were copied from somewhere, and a copy that slips by
 * one character files a delivery against a different person's report. The
 * project rule is that a foreign key is picked, never typed.
 *
 * So the normal path is now a link: the lab order screen knows both ids and
 * passes them in the URL, and this screen shows them rather than asking. The
 * standalone case keeps a patient picker, and the order id stays a field only
 * because no order picker exists yet — with a note saying where to find it.
 */
export function LabDispatchCreatePage() {
  useRequirePermission(P.LAB.DISPATCH_MANAGE);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prefilledOrderId = searchParams.get("order_id") ?? "";
  const prefilledPatientId = searchParams.get("patient_id") ?? "";
  const backTo = safeReturnPath(searchParams.get("return"), "/lab?tab=dispatch");

  const [orderId, setOrderId] = useState(prefilledOrderId);
  const [patientId, setPatientId] = useState(prefilledPatientId);
  const [method, setMethod] = useState("counter");
  const [dispatchedTo, setDispatchedTo] = useState("");
  const [notes, setNotes] = useState("");

  const record = useMutation({
    mutationFn: () =>
      labService.createReportDispatch({
        order_id: orderId.trim(),
        patient_id: patientId.trim(),
        dispatch_method: method as CreateReportDispatchRequest["dispatch_method"],
        dispatched_to: dispatchedTo.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-report-dispatches"] });
      toast.success("Dispatch recorded");
      navigate(backTo);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record dispatch" }),
  });

  const cameFromAnOrder = prefilledOrderId !== "" && prefilledPatientId !== "";

  return (
    <Stack>
      <PageHeader
        title="Record a dispatch"
        subtitle="Recording how a report was sent is what makes its delivery checkable later."
        icon={<IconSend size={20} stroke={1.5} />}
        actions={
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate(backTo)}
          >
            Dispatches
          </Button>
        }
      />
      <Stack maw={560}>
        {cameFromAnOrder ? (
          <Alert tone="info">
            Recording delivery of order <strong>{prefilledOrderId}</strong>. The patient came with
            it, so neither has to be typed.
          </Alert>
        ) : (
          <>
            <TextInput
              label="Order id"
              description="On the lab order screen, or use the Record dispatch button there to fill this in."
              value={orderId}
              onChange={(event) => setOrderId(event.currentTarget.value)}
            />
            <PatientSearchSelect value={patientId} onChange={setPatientId} required />
          </>
        )}
        <MantineSelect
          label="How it was sent"
          data={LAB_DISPATCH_METHOD_OPTIONS}
          value={method}
          onChange={(value) => setMethod(value ?? "counter")}
          allowDeselect={false}
        />
        <TextInput
          label="Sent to"
          description="The address, number or person who took it."
          value={dispatchedTo}
          onChange={(event) => setDispatchedTo(event.currentTarget.value)}
        />
        <Textarea
          label="Notes"
          autosize
          minRows={2}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
        <Group>
          <Button
            tone="primary"
            disabled={orderId.trim() === "" || patientId.trim() === ""}
            loading={record.isPending}
            onClick={() => record.mutate()}
          >
            Record dispatch
          </Button>
          <Button tone="ghost" onClick={() => navigate(backTo)}>
            Cancel
          </Button>
        </Group>
        {!cameFromAnOrder && (
          <Text size="xs" c="dimmed">
            A dispatch belongs to one verified order. Starting from the order screen fills both
            identifiers in and is the safer route.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
