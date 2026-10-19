import { Box, Stack, Text, Title } from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { Button, Modal } from "@/components/ui";

interface ScanSharePosterProps {
  opened: boolean;
  onClose: () => void;
  hospitalName: string;
  counterName: string;
  counterCode: string;
  hipId: string;
  payload: string;
}

const STEPS_EN = [
  "Open your ABHA app (ABHA, Aarogya Setu or any ABDM app) and choose Scan & Share.",
  "Scan this code and share your profile.",
  "Keep the token number the app shows and wait to be called.",
];
const STEPS_HI = [
  "अपना ABHA ऐप (ABHA, आरोग्य सेतु या कोई भी ABDM ऐप) खोलें और स्कैन और शेयर चुनें।",
  "यह कोड स्कैन करें और अपनी प्रोफ़ाइल शेयर करें।",
  "ऐप में दिखा टोकन नंबर रखें और अपनी बारी की प्रतीक्षा करें।",
];

/**
 * Paper is printed black on white whatever the screen theme, so the print
 * window carries its own sheet. A5, portrait.
 */
const POSTER_CSS = `
@page { size: A5 portrait; margin: 12mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'IBM Plex Sans', 'Noto Sans Devanagari', system-ui, sans-serif; color: black; background: white; }
.poster { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.poster-hospital { font-size: 20px; font-weight: 700; }
.poster-counter { font-size: 16px; }
.poster-call { font-size: 22px; font-weight: 700; margin-top: 6px; }
.poster-qr svg { width: 72mm; height: 72mm; }
.poster-steps { text-align: left; font-size: 12px; line-height: 1.5; width: 100%; }
.poster-meta { font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
`;

function Steps({ steps }: { steps: string[] }) {
  return (
    <Stack gap={2} className="poster-steps">
      {steps.map((step, i) => (
        <Text key={step} size="sm">
          {i + 1}. {step}
        </Text>
      ))}
    </Stack>
  );
}

/** The A5 poster for one registration counter: preview, then print. */
export function ScanSharePoster(props: ScanSharePosterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const print = () => {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win || !ref.current) return;
    win.document.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Scan &amp; Share — ${props.counterName.replace(/[<&]/g, "")}</title>` +
        `<style>${POSTER_CSS}</style></head><body>${ref.current.innerHTML}` +
        `<script>window.onload=function(){window.print();window.close();}</script></body></html>`,
    );
    win.document.close();
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Counter poster" size="md">
      <Stack>
        <Box ref={ref}>
          <Stack align="center" gap="xs" className="poster">
            <Title order={3} className="poster-hospital">
              {props.hospitalName}
            </Title>
            <Text className="poster-counter">{props.counterName}</Text>
            <Text fw={700} size="lg" className="poster-call">
              Scan with your ABHA app · अपने ABHA ऐप से स्कैन करें
            </Text>
            <Box className="poster-qr">
              <QRCodeSVG value={props.payload} size={240} level="M" marginSize={2} />
            </Box>
            <Steps steps={STEPS_EN} />
            <Steps steps={STEPS_HI} />
            <Text size="xs" ff="monospace" className="poster-meta">
              HIP {props.hipId} · Counter {props.counterCode}
            </Text>
          </Stack>
        </Box>
        <Button tone="primary" onClick={print}>
          Print A5 poster
        </Button>
      </Stack>
    </Modal>
  );
}
