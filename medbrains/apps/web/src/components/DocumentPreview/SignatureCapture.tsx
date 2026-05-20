import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import type { SignatureCaptureFormInput, SignerRoleFormValue } from "@medbrains/schemas";
import { signatureCaptureFormSchema, toSignerRoleFormValue } from "@medbrains/schemas";
import { IconEraser, IconSignature } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

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

function getPointerPosition(
  event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  rect: DOMRect,
): { x: number; y: number } | null {
  if ("touches" in event) {
    const touch = event.touches.item(0);
    return touch ? { x: touch.clientX - rect.left, y: touch.clientY - rect.top } : null;
  }
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function SignatureCapture({
  opened,
  onClose,
  onCapture,
  mode = "signature",
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
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

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const point = getPointerPosition(e, rect);
      if (!point) return;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    },
    [],
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const point = getPointerPosition(e, rect);
      if (!point) return;
      ctx.lineWidth = mode === "thumb" ? 4 : 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    },
    [isDrawing, mode],
  );

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const closeAndReset = () => {
    clearCanvas();
    reset(DEFAULT_SIGNATURE_VALUES);
    onClose();
  };

  const handleCapture = handleSubmit((values) => {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png");

    onCapture({
      signer_role: values.signer_role,
      signer_name: values.signer_name,
      designation: values.designation || undefined,
      registration_number: values.registration_number || undefined,
      signature_type: mode === "thumb" ? "biometric_thumb" : "digital_pen",
      signature_image_url: dataUrl,
      thumb_impression: mode === "thumb",
    });

    closeAndReset();
  });

  const canvasHeight = mode === "thumb" ? 250 : 150;

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

        <Text size="sm" fw={500} mt="xs">
          {mode === "thumb" ? "Place thumb impression below" : "Sign in the box below"}
        </Text>

        <div
          style={{
            border: "2px dashed var(--mantine-color-gray-4)",
            borderRadius: 8,
            cursor: "crosshair",
          }}
        >
          <canvas
            ref={canvasRef}
            width={460}
            height={canvasHeight}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            style={{ display: "block", width: "100%", touchAction: "none" }}
          />
        </div>

        <Group justify="space-between">
          <Button
            variant="subtle"
            color="slate"
            leftSection={<IconEraser size={16} />}
            onClick={clearCanvas}
          >
            Clear
          </Button>
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
