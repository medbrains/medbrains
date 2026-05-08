import { Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconEraser, IconSignature } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";

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

const SIGNER_ROLES = [
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerRole, setSignerRole] = useState<string>("patient");
  const [signerName, setSignerName] = useState("");
  const [designation, setDesignation] = useState("");
  const [regNumber, setRegNumber] = useState("");

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const touch = "touches" in e ? e.touches[0] : undefined;
      const x = touch ? touch.clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
      const y = touch ? touch.clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
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
      const touch = "touches" in e ? e.touches[0] : undefined;
      const x = touch ? touch.clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
      const y = touch ? touch.clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
      ctx.lineWidth = mode === "thumb" ? 4 : 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      ctx.lineTo(x, y);
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

  const handleCapture = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png");

    onCapture({
      signer_role: signerRole,
      signer_name: signerName,
      designation: designation || undefined,
      registration_number: regNumber || undefined,
      signature_type: mode === "thumb" ? "biometric_thumb" : "digital_pen",
      signature_image_url: dataUrl,
      thumb_impression: mode === "thumb",
    });

    clearCanvas();
    setSignerName("");
    setDesignation("");
    setRegNumber("");
    onClose();
  };

  const canvasHeight = mode === "thumb" ? 250 : 150;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === "thumb" ? "Thumb Impression" : "Signature Capture"}
      size="md"
    >
      <Stack gap="sm">
        <Select
          label="Signer Role"
          data={SIGNER_ROLES}
          value={signerRole}
          onChange={(v) => setSignerRole(v ?? "patient")}
        />
        <TextInput
          label="Signer Name"
          value={signerName}
          onChange={(e) => setSignerName(e.currentTarget.value)}
          required
        />
        <Group grow>
          <TextInput
            label="Designation"
            value={designation}
            onChange={(e) => setDesignation(e.currentTarget.value)}
          />
          <TextInput
            label="Registration No."
            value={regNumber}
            onChange={(e) => setRegNumber(e.currentTarget.value)}
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
            onClick={handleCapture}
            disabled={!signerName}
          >
            Capture
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
