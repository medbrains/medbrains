import { Group, Stack, Text } from "@mantine/core";
import type { AbhaVerificationStep } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Chip, ChipGroup, Input } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { AbhaAddressRules } from "./AbhaAddressRules";
import { AbhaFailureAlert } from "./AbhaFailureAlert";
import { ABHA_MESSAGES, addressName, isValidAddress } from "./abhaRules";

interface AbhaAddressStepProps {
  /** The enrolment at its `choose_address` stage. */
  step: AbhaVerificationStep;
  /** The step ABDM answers with once an address is chosen or kept. */
  onDone: (next: AbhaVerificationStep) => void;
}

/**
 * Choosing the new ABHA's address: ABDM's suggestions or a typed one, NHA's
 * rules beside the field, and (CRT_ABHA_112) a taken address offered as a
 * choice: keep the existing address or pick another.
 */
export function AbhaAddressStep({ step, onDone }: AbhaAddressStepProps) {
  const [address, setAddress] = useState("");
  const choose = useMutation({
    mutationFn: (id: string) => abhaService.chooseAddress(id, address),
    onSuccess: onDone,
  });
  const keep = useMutation({
    mutationFn: (id: string) => abhaService.chooseAddress(id, "", true),
    onSuccess: onDone,
  });
  // A taken address is a choice for the desk, not a failure.
  const taken = choose.error?.message === ABHA_MESSAGES.addressTaken;
  const failure = keep.error ?? (taken ? null : choose.error);
  const domain = step.address_domain ?? "abdm";
  const pick = (value: string) => {
    setAddress(value);
    choose.reset();
  };

  return (
    <Stack>
      {failure && <AbhaFailureAlert error={failure} />}
      <Text size="sm" fw={600}>
        Choose an ABHA address — the patient's easy-to-remember health ID
      </Text>
      {step.suggestions.length > 0 && (
        <ChipGroup value={address} onChange={(v) => pick(String(v))}>
          <Group gap="xs">
            {step.suggestions.map((s) => (
              <Chip key={s} value={s}>
                {s}
              </Chip>
            ))}
          </Group>
        </ChipGroup>
      )}
      <Input
        label="Or type one"
        description={`ABDM adds @${domain}.`}
        value={address}
        onChange={(e) => pick(e.currentTarget.value.trim())}
      />
      <AbhaAddressRules name={addressName(address, domain)} domain={domain} />
      {taken ? (
        <AddressTakenChoice
          keeping={keep.isPending}
          onKeep={() => keep.mutate(step.id)}
          onChooseAnother={() => pick("")}
        />
      ) : (
        <Button
          tone="primary"
          disabled={!isValidAddress(addressName(address, domain), domain)}
          loading={choose.isPending}
          onClick={() => choose.mutate(step.id)}
        >
          Create ABHA address
        </Button>
      )}
    </Stack>
  );
}

interface AddressTakenChoiceProps {
  keeping: boolean;
  onKeep: () => void;
  onChooseAnother: () => void;
}

/** NHA's two choices when the address typed is already someone's ABHA address. */
function AddressTakenChoice({ keeping, onKeep, onChooseAnother }: AddressTakenChoiceProps) {
  return (
    <Alert tone="warning" title={ABHA_MESSAGES.addressTaken}>
      <Group mt="xs">
        <Button tone="primary" loading={keeping} onClick={onKeep}>
          Proceed with the existing ABHA address
        </Button>
        <Button tone="secondary" onClick={onChooseAnother}>
          Create a new ABHA address
        </Button>
      </Group>
    </Alert>
  );
}
