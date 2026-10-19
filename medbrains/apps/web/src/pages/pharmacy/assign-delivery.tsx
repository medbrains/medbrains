import { Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { DeliveryMode, DeliveryRunner, PharmacyDelivery } from "@medbrains/types";
import { IconUserCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, Modal, SegmentedControl, Select, toast } from "@/components/ui";
import { deliveryService } from "@/services/delivery.service";

interface AssignDeliveryProps {
  delivery: PharmacyDelivery;
  runners: DeliveryRunner[];
}

/**
 * A delivery waiting for someone to take it — one a patient asked for, or
 * arranged without a runner — is given to a runner or a courier.
 */
export function AssignDelivery({ delivery, runners }: AssignDeliveryProps) {
  const queryClient = useQueryClient();
  const [opened, modal] = useDisclosure(false);
  const [mode, setMode] = useState<DeliveryMode>("runner");
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const assign = useMutation({
    mutationFn: () =>
      deliveryService.assignDelivery(delivery.id, {
        mode,
        ...(mode === "runner" && runnerId ? { runner_id: runnerId } : {}),
        ...(mode === "courier"
          ? { courier_name: courier.trim(), tracking_ref: tracking.trim() || undefined }
          : {}),
      }),
    onSuccess: () => {
      toast.success("Given out. Dispatch it when it leaves.");
      modal.close();
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not given out" }),
  });
  const ready = mode === "runner" ? runnerId !== null : courier.trim().length > 0;

  return (
    <>
      <Button
        size="xs"
        tone="primary"
        leftSection={<IconUserCheck size={14} />}
        onClick={modal.open}
      >
        Give to runner or courier
      </Button>
      <Modal opened={opened} onClose={modal.close} title="Who takes it">
        <Stack gap="sm">
          <SegmentedControl
            aria-label="How it travels"
            data={[
              { value: "runner", label: "Our runner" },
              { value: "courier", label: "Courier" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as DeliveryMode)}
          />
          {mode === "runner" ? (
            <Select
              label="Runner"
              data={runners.map((r) => ({ value: r.id, label: r.full_name }))}
              value={runnerId}
              onChange={setRunnerId}
              searchable
              required
            />
          ) : (
            <>
              <Input
                label="Courier"
                value={courier}
                onChange={(e) => setCourier(e.currentTarget.value)}
                required
              />
              <Input
                label="Tracking number (optional)"
                value={tracking}
                onChange={(e) => setTracking(e.currentTarget.value)}
              />
            </>
          )}
          <Group justify="flex-end">
            <Button
              tone="primary"
              loading={assign.isPending}
              disabled={!ready}
              onClick={() => assign.mutate()}
            >
              Give it out
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
