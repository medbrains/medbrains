import { Box, Stack, Text, Title } from "@mantine/core";
import type { IssuedDeviceBindingCode } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { Alert, Button, Modal } from "@/components/ui";

interface BindingQrSheetProps {
  code: IssuedDeviceBindingCode | null;
  onClose: () => void;
}

/** Paper prints black on white whatever the screen theme. A5 portrait. */
const SHEET_CSS = `
@page { size: A5 portrait; margin: 12mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: black; background: white; }
.sheet { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.sheet-qr svg { width: 80mm; height: 80mm; }
.sheet-meta { font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
`;

/**
 * The QR is shown once: the server does not keep the signed text, so a lost
 * sheet is replaced by issuing a new code and revoking this one.
 */
export function BindingQrSheet({ code, onClose }: BindingQrSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const print = () => {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win || !ref.current) return;
    win.document.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Bind the MedBrains app</title>` +
        `<style>${SHEET_CSS}</style></head><body>${ref.current.innerHTML}` +
        `<script>window.onload=function(){window.print();window.close();}</script></body></html>`,
    );
    win.document.close();
  };

  return (
    <Modal opened={code !== null} onClose={onClose} title="Hospital binding QR" size="md">
      {code && (
        <Stack>
          <Box ref={ref}>
            <Stack align="center" gap="xs" className="sheet">
              <Title order={3}>{code.tenant_name}</Title>
              <Text>{code.label}</Text>
              <Text fw={700}>Open the MedBrains app and tap “Scan hospital QR”</Text>
              <Box className="sheet-qr">
                <QRCodeSVG
                  value={code.qr}
                  size={240}
                  level="M"
                  aria-label={`Binding QR for ${code.label}`}
                />
              </Box>
              <Text size="xs" className="sheet-meta">
                Binds up to {code.max_uses} device{code.max_uses === 1 ? "" : "s"} · valid until{" "}
                {new Date(code.expires_at).toLocaleString()}
              </Text>
            </Stack>
          </Box>
          <Alert tone="warning">
            Anyone holding this QR can bind a device to {code.tenant_name} until it expires or is
            used up. Keep the printout with you and shred it afterwards. It cannot be shown again.
          </Alert>
          <Button
            tone="primary"
            leftSection={<IconPrinter size={16} aria-hidden />}
            onClick={print}
          >
            Print
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
