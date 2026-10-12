// A visitor or attendant pass, card-sized, printed from the browser's print
// dialog. Its QR carries the pass number, which the gate scans (Gate check)
// to see whether the pass lets the holder in now.
import { Box, Group, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Alert, Button, Image, Modal } from "@/components/ui";
import { frontOfficeService } from "@/services/frontOffice.service";

/** An SVG string as an image source: drawn without injecting markup. */
const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

interface VisitorPassPrintModalProps {
  passId: string | null;
  onClose: () => void;
}

export function VisitorPassPrintModal({ passId, onClose }: VisitorPassPrintModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const {
    data: pass,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["visitor-pass-print", passId],
    queryFn: () => frontOfficeService.getVisitorPassPrintData(passId ?? ""),
    enabled: Boolean(passId),
  });

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=320");
    if (!w || !cardRef.current) return;
    w.document.write(`<html><head><title>Pass ${pass?.pass_number ?? ""}</title>
      <style>@page { size: 85.6mm 54mm; margin: 0; } body { margin: 0; font-family: sans-serif; }</style>
      </head><body onload="window.print(); window.close();">${cardRef.current.innerHTML}</body></html>`);
    w.document.close();
  };

  return (
    <Modal opened={Boolean(passId)} onClose={onClose} title="Print pass" size="md">
      <Stack gap="sm">
        {isLoading && <Loader size="sm" aria-label="Preparing the pass" />}
        {isError && <Alert tone="danger">The pass couldn't be prepared. Try again.</Alert>}
        {pass && (
          <>
            <Box ref={cardRef}>
              <Box
                style={{
                  width: "85.6mm",
                  height: "54mm",
                  padding: "3mm",
                  boxSizing: "border-box",
                  border: "1px solid #999",
                  display: "flex",
                  gap: "3mm",
                  fontFamily: "sans-serif",
                }}
              >
                <Box style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1mm" }}>
                  <Box
                    style={{ fontSize: "7pt", letterSpacing: "0.3mm", textTransform: "uppercase" }}
                  >
                    Visitor pass
                  </Box>
                  <Box style={{ fontSize: "12pt", fontWeight: 700 }}>{pass.visitor_name}</Box>
                  <Box style={{ fontSize: "7pt" }}>
                    {[pass.relation, pass.visitor_phone].filter(Boolean).join(" · ")}
                  </Box>
                  {pass.patient_name && (
                    <Box style={{ fontSize: "7pt" }}>Visiting {pass.patient_name}</Box>
                  )}
                  <Box style={{ fontSize: "8pt", fontWeight: 600 }}>
                    {pass.patient_ward ?? "Any ward"}
                    {pass.patient_bed ? ` · Bed ${pass.patient_bed}` : ""}
                  </Box>
                  <Box style={{ fontSize: "7pt" }}>Valid until {pass.valid_until}</Box>
                  <Box style={{ fontSize: "7pt", fontFamily: "monospace", marginTop: "auto" }}>
                    {pass.pass_number}
                  </Box>
                </Box>
                <Image
                  src={svgDataUri(pass.qr_svg)}
                  alt={`QR code for pass ${pass.pass_number}`}
                  style={{ width: "26mm", height: "26mm", flexShrink: 0, alignSelf: "center" }}
                />
              </Box>
            </Box>
            <Text size="xs" c="dimmed">
              The gate scans the QR to check the pass is still valid.
            </Text>
            <Group justify="flex-end">
              <Button tone="ghost" onClick={onClose}>
                Close
              </Button>
              <Button tone="primary" onClick={print}>
                Print pass
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
