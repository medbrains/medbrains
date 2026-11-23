import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import type { SignatureCaptureFormInput, SignerRoleFormValue } from "@medbrains/schemas";
import { signatureCaptureFormSchema, toSignerRoleFormValue } from "@medbrains/schemas";
import { IconSignature } from "@tabler/icons-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { SignaturePad } from "@/components/ui";

interface SignatureCaptureProps {
  opened: boolean;
  onClose: () => void;
  onCapture: (data: SignatureData) => void;
  mode?: "signature" | "thumb";
}

export interface SignatureData {
  signer_role: string;
  signer_name: string;
  designation?: string;
  registration_number?: string;
  signature_type: string;
  signature_image_url?: string;
  thumb_impression: boolean;
}

const DEFAULT_SIGNATURE_VALUES: SignatureCaptureFormInput = {
  signer_role: "patient",
  signer_name: "",
  designation: "",
  registration_number: "",
};

const SIGNER_ROLES: Array<{ value: SignerRoleFormValue; label: string }> = [
  { value: "patient", label: "Patient" },
  { value: "guardian", label: "Guardian" },
  { value: "witness", label: "Witness" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
];

export function SignatureCapture({
  opened,
  onClose,
  onCapture,
  mode = "signature",
}: SignatureCaptureProps) {
  const [image, setImage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SignatureCaptureFormInput>({
    resolver: zodResolver(signatureCaptureFormSchema),
    defaultValues: DEFAULT_SIGNATURE_VALUES,
    mode: "onTouched",
  });
  const signerName = watch("signer_name");

  const closeAndReset = () => {
    setImage(null);
    reset(DEFAULT_SIGNATURE_VALUES);
    onClose();
  };

  const handleCapture = handleSubmit((values) => {
    onCapture({
      signer_role: values.signer_role,
      signer_name: values.signer_name,
      designation: values.designation || undefined,
      registration_number: values.registration_number || undefined,
      signature_type: mode === "thumb" ? "biometric_thumb" : "digital_pen",
      signature_image_url: image ?? undefined,
      thumb_impression: mode === "thumb",
    });

    closeAndReset();
  });

  return (
    <Modal
      opened={opened}
      onClose={closeAndReset}
      title={mode === "thumb" ? "Thumb Impression" : "Signature Capture"}
      size="md"
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="signer_role"
          render={({ field }) => (
            <Select
              label="Signer Role"
              data={SIGNER_ROLES}
              value={field.value}
              onChange={(value) => field.onChange(toSignerRoleFormValue(value))}
            />
          )}
        />
        <Controller
          control={control}
          name="signer_name"
          render={({ field }) => (
            <TextInput
              label="Signer Name"
              value={field.value}
              onChange={field.onChange}
              error={errors.signer_name?.message}
              required
            />
          )}
        />
        <Group grow>
          <Controller
            control={control}
            name="designation"
            render={({ field }) => (
              <TextInput label="Designation" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="registration_number"
            render={({ field }) => (
              <TextInput label="Registration No." value={field.value} onChange={field.onChange} />
            )}
          />
        </Group>

        <SignaturePad
          label={mode === "thumb" ? "Place thumb impression below" : "Sign in the box below"}
          lineWidth={mode === "thumb" ? 4 : 2}
          height={mode === "thumb" ? 250 : 150}
          onChange={setImage}
        />

        <Group justify="flex-end">
          <Button
            leftSection={<IconSignature size={16} />}
            onClick={() => void handleCapture()}
            disabled={!signerName}
          >
            Capture
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
