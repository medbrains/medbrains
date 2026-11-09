// Record a policy's eligible room rent from its schedule or e-card: rupees a
// day, or a percentage of the sum insured. Until it is set the room check can
// only say "no limit recorded".

import { Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, NumberField, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

interface RoomLimitModalProps {
  policyId: string;
  insurer: string | null;
  onClose: () => void;
}

/** Two figures, either one enough; saving re-runs the room check. */
export function RoomLimitModal({ policyId, insurer, onClose }: RoomLimitModalProps) {
  const queryClient = useQueryClient();
  const [perDay, setPerDay] = useState<number | "">("");
  const [percent, setPercent] = useState<number | "">("");
  const mutation = useMutation({
    mutationFn: () =>
      ipdService.setRoomRentLimit(policyId, {
        room_rent_limit_per_day: perDay === "" ? null : perDay,
        room_rent_limit_percent: percent === "" ? null : percent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ipd", "room-eligibility"] });
      toast.success("Room rent limit saved");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Modal
      opened
      onClose={onClose}
      title="Policy room rent limit"
      size="sm"
      primaryAction={{
        label: "Save limit",
        onClick: () => mutation.mutate(),
        loading: mutation.isPending,
        disabled: perDay === "" && percent === "",
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          As written in the {insurer ?? "policy"} schedule or e-card.
        </Text>
        <NumberField
          label="Eligible room rent a day (₹)"
          min={1}
          value={perDay}
          onChange={(v) => setPerDay(typeof v === "number" ? v : "")}
        />
        <NumberField
          label="Or a percentage of the sum insured a day"
          min={0.1}
          max={100}
          decimalScale={2}
          value={percent}
          onChange={(v) => setPercent(typeof v === "number" ? v : "")}
        />
      </Stack>
    </Modal>
  );
}
