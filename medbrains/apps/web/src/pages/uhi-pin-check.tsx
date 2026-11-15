import { PinInput, Stack, Text } from "@mantine/core";
import type { UhiPinResult, UhiRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal } from "@/components/ui";
import { uhiService } from "@/services/uhi.service";

const PIN_LENGTH = 4;

interface UhiPinCheckProps {
  request: UhiRequest | null;
  onClose: () => void;
}

/**
 * The desk checks the 4-digit PIN the patient's app shows for a visit booked
 * through UHI. The server compares it with the booking's hash; the screen
 * never sees the PIN itself, only whether it matched and the tries left.
 */
export function UhiPinCheck({ request, onClose }: UhiPinCheckProps) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<UhiPinResult | null>(null);
  const check = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) => uhiService.checkPin(id, code),
    onSuccess: (r) => {
      setResult(r);
      setPin("");
      void queryClient.invalidateQueries({ queryKey: ["uhi", "requests"] });
    },
  });
  const close = () => {
    setPin("");
    setResult(null);
    check.reset();
    onClose();
  };
  return (
    <Modal
      opened={request !== null}
      onClose={close}
      title="Check the patient's PIN"
      primaryAction={
        result?.matched
          ? { label: "Done", onClick: close }
          : {
              label: "Check",
              disabled: pin.length !== PIN_LENGTH,
              loading: check.isPending,
              onClick: () => request && check.mutate({ id: request.id, code: pin }),
            }
      }
      secondaryAction={result?.matched ? undefined : { label: "Cancel", onClick: close }}
    >
      <Stack gap="md">
        <Text size="sm">
          {`Ask ${request?.customer_name ?? "the patient"} for the PIN their app shows for this visit.`}
        </Text>
        {!result?.matched && (
          <PinInput
            length={PIN_LENGTH}
            type="number"
            mask
            oneTimeCode={false}
            value={pin}
            onChange={setPin}
            aria-label="PIN from the patient's app"
            data-testid="input-uhi-pin"
          />
        )}
        {result?.matched && (
          <Alert tone="success" title="The PIN matches">
            This is the patient's booking. Check them in at OPD as usual.
          </Alert>
        )}
        {result && !result.matched && (
          <Alert tone="danger" title="That PIN does not match">
            {`${result.tries_left} tries left. Ask the patient to read it again from their app.`}
          </Alert>
        )}
        {check.isError && (
          <Alert tone="danger" title="Could not check the PIN">
            {check.error.message}
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}
