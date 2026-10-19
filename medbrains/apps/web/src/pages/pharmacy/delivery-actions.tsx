import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type DeliveryRunner, P, type PharmacyDelivery } from "@medbrains/types";
import { IconCheck, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, Modal, NumberField, TextArea, toast } from "@/components/ui";
import { deliveryService } from "@/services/delivery.service";
import { AssignDelivery } from "./assign-delivery";

interface DeliveryActionsProps {
  delivery: PharmacyDelivery;
  runners: DeliveryRunner[];
}

/** What can be done next to a delivery, by whoever may do it. */
export function DeliveryActions({ delivery, runners }: DeliveryActionsProps) {
  const canArrange = useHasPermission(P.PHARMACY.DELIVERIES.ARRANGE);
  const canComplete = useHasPermission(P.PHARMACY.DELIVERIES.COMPLETE);
  const queryClient = useQueryClient();
  const [handingOver, handOver] = useDisclosure(false);
  const [failing, fail] = useDisclosure(false);
  const [code, setCode] = useState("");
  const [cash, setCash] = useState<number | string>(Number(delivery.amount_due));
  const [reason, setReason] = useState("");
  const done = (title: string) => () => {
    toast.success(title);
    handOver.close();
    fail.close();
    void queryClient.invalidateQueries({ queryKey: ["pharmacy-deliveries"] });
  };
  const failed = (title: string) => (e: Error) => toast.error(e.message, { title });

  const dispatch = useMutation({
    mutationFn: () => deliveryService.dispatchDelivery(delivery.id),
    onSuccess: done("On its way. The patient has been texted their code."),
    onError: failed("Not dispatched"),
  });
  const cancel = useMutation({
    mutationFn: () => deliveryService.cancelDelivery(delivery.id),
    onSuccess: done("Delivery cancelled"),
    onError: failed("Not cancelled"),
  });
  const complete = useMutation({
    mutationFn: () =>
      deliveryService.completeDelivery(delivery.id, {
        ...(delivery.mode === "runner" ? { code: code.trim() } : {}),
        ...(delivery.payment === "cash_on_delivery" ? { cash_collected: Number(cash) } : {}),
      }),
    onSuccess: done("Delivered"),
    onError: failed("Not recorded"),
  });
  const markFailed = useMutation({
    mutationFn: () => deliveryService.failDelivery(delivery.id, { reason: reason.trim() }),
    onSuccess: done("Recorded as not delivered. Bring it back to the pharmacy."),
    onError: failed("Not recorded"),
  });

  const cod = delivery.payment === "cash_on_delivery";
  // Nobody has it yet: a patient's request, or arranged without a runner.
  const unassigned = delivery.mode === "runner" && !delivery.runner_id;
  return (
    <>
      <Group gap="xs" wrap="nowrap">
        {canArrange && delivery.status === "arranged" && (
          <>
            {unassigned ? (
              <AssignDelivery delivery={delivery} runners={runners} />
            ) : (
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconTruckDelivery size={14} />}
                loading={dispatch.isPending}
                onClick={() => dispatch.mutate()}
              >
                Dispatch
              </Button>
            )}
            <Button
              size="xs"
              tone="ghost"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel
            </Button>
          </>
        )}
        {canComplete && delivery.status === "out_for_delivery" && (
          <>
            <Button
              size="xs"
              tone="primary"
              leftSection={<IconCheck size={14} />}
              onClick={handOver.open}
            >
              Delivered
            </Button>
            <Button
              size="xs"
              tone="secondary"
              leftSection={<IconX size={14} />}
              onClick={fail.open}
            >
              Not delivered
            </Button>
          </>
        )}
      </Group>
      <Modal opened={handingOver} onClose={handOver.close} title="Hand over the medicines">
        <Stack gap="sm">
          {delivery.mode === "runner" && (
            <Input
              label="Patient's code"
              description="The six digits texted to the patient. Hand over only against it."
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              required
            />
          )}
          {cod && (
            <NumberField
              label="Cash taken"
              description={`₹${delivery.amount_due} due. Hand the cash to the pharmacy counter.`}
              min={0}
              decimalScale={2}
              value={cash}
              onChange={setCash}
              required
            />
          )}
          {delivery.mode === "courier" && (
            <Text size="sm">Confirm only once {delivery.courier_name} reports it delivered.</Text>
          )}
          <Group justify="flex-end">
            <Button
              tone="primary"
              loading={complete.isPending}
              disabled={delivery.mode === "runner" && code.trim().length !== 6}
              onClick={() => complete.mutate()}
            >
              Delivered
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={failing} onClose={fail.close} title="Not delivered">
        <Stack gap="sm">
          <TextArea
            label="What happened"
            placeholder="Nobody home; the patient refused it; wrong address…"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button
              tone="danger"
              loading={markFailed.isPending}
              disabled={reason.trim().length === 0}
              onClick={() => markFailed.mutate()}
            >
              Record and bring it back
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
