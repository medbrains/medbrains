import { Box, Stack, Text } from "@mantine/core";
import type { AbhaCardQr } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useInterval } from "react-use";
import { Alert, Button, Modal, TextArea } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import classes from "./abha-qr-scan.module.scss";

/** How often a camera frame is checked for a QR. */
const SCAN_EVERY_MS = 300;

/** The browser's own QR reader (Chromium); absent elsewhere. */
interface DetectedCode {
  rawValue: string;
}
interface QrDetector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}
type QrDetectorCtor = new (options: { formats: string[] }) => QrDetector;

const detectorCtor = (): QrDetectorCtor | undefined =>
  (globalThis as { BarcodeDetector?: QrDetectorCtor }).BarcodeDetector;

interface AbhaQrScanModalProps {
  opened: boolean;
  onClose: () => void;
  onRead: (card: AbhaCardQr) => void;
}

/**
 * Read the QR on a patient's ABHA card (M1 VRFY_ABHA_501): the camera where
 * the browser can read QR codes, or the desk's handheld scanner, which types
 * the QR into the box. What the card says is then verified by OTP.
 */
export function AbhaQrScanModal({ opened, onClose, onRead }: AbhaQrScanModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Scan the ABHA card">
      {opened && <ScanFlow onRead={onRead} />}
    </Modal>
  );
}

function ScanFlow({ onRead }: Pick<AbhaQrScanModalProps, "onRead">) {
  const [typed, setTyped] = useState("");
  const read = useMutation({ mutationFn: abhaService.readQr, onSuccess: onRead });
  // The camera sees the same QR many times a second; read each one once.
  const last = useRef<string | null>(null);
  const camera = useCamera(!read.isPending, (payload) => {
    if (payload === last.current) return;
    last.current = payload;
    read.mutate(payload);
  });

  return (
    <Stack>
      {read.isError && (
        <Alert tone="danger" title="Not an ABHA card">
          {read.error.message}
        </Alert>
      )}
      {camera.supported ? (
        <Box component="video" ref={camera.video} className={classes.video} muted playsInline />
      ) : (
        <Text size="sm" c="dimmed">
          This browser cannot read QR codes from the camera. Use the desk's QR scanner instead.
        </Text>
      )}
      {camera.error && (
        <Alert tone="warning" title="The camera is not available">
          {camera.error}
        </Alert>
      )}
      <TextArea
        label="Or scan with the desk's QR scanner"
        description="Click here, then scan the card; the scanner types what the QR holds."
        autosize
        minRows={2}
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
      />
      <Button
        tone="primary"
        disabled={!typed.trim()}
        loading={read.isPending}
        onClick={() => read.mutate(typed)}
      >
        Read the card
      </Button>
    </Stack>
  );
}

interface Camera {
  supported: boolean;
  error: string | null;
  video: React.RefObject<HTMLVideoElement | null>;
}

/** The rear camera, checked for a QR every few hundred milliseconds. */
function useCamera(active: boolean, onPayload: (payload: string) => void): Camera {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Detector = detectorCtor();
  const detector = useRef<QrDetector | null>(null);

  // The camera is an external device: start it on open, stop it on close.
  useEffect(() => {
    if (!Detector || !navigator.mediaDevices) return;
    detector.current = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      })
      .catch(() => setError("Allow the camera for this site, or use the desk's QR scanner."));
    return () => {
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [Detector]);

  useInterval(
    () => {
      const el = video.current;
      if (!el || !detector.current || el.readyState < 2) return;
      detector.current
        .detect(el)
        .then((codes) => {
          const payload = codes[0]?.rawValue;
          if (payload) onPayload(payload);
        })
        // A frame the browser cannot read is skipped; the next one is tried.
        .catch(() => undefined);
    },
    active && Detector && !error ? SCAN_EVERY_MS : null,
  );

  return { supported: Boolean(Detector), error, video };
}
