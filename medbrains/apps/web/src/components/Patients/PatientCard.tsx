import { useHasPermission } from "@medbrains/stores";
import type { PatientCardPrintData } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Button, toast } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

/**
 * Thermal roll width. 58mm is the common small printer; the layout is built
 * for it and an 80mm printer simply leaves margin, which is the safe
 * direction to be wrong in.
 */
const ROLL_WIDTH_MM = 58;

/**
 * The printable width inside the roll. Thermal mechanisms do not print to the
 * paper edge — 2mm each side is the usual dead zone, and a card laid out to
 * the full 58mm loses its right-hand characters on half the printers in the
 * field.
 */
const PRINT_WIDTH_MM = 54;

/**
 * The card a patient carries between counters.
 *
 * At a camp this is the whole identification chain: registration prints it,
 * and the lab bench and the pharmacy scan it rather than re-typing a name
 * that was said once across a noisy table. Re-typing is where a result gets
 * attached to the wrong person.
 *
 * A QR rather than a 1D barcode, deliberately. `qrcode.react` is already a
 * dependency here — the public booking page uses it — and a QR survives being
 * folded, creased and thumbed in a pocket far better than a linear barcode,
 * which stops scanning the moment one bar is damaged. The cost is that a very
 * old 1D-only laser scanner cannot read it; any 2D imager can, and so can a
 * phone, which at a camp is often what is actually available.
 */
export function PrintPatientCardButton({ patientId }: { patientId: string }) {
  const canPrint = useHasPermission(P.PATIENTS.VIEW);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PatientCardPrintData | null>(null);

  const fetchCard = useMutation({
    mutationFn: () => patientsService.getPatientCardPrintData(patientId),
    onSuccess: setPending,
    onError: (error: Error) => toast.error(error.message, { title: "Could not print the card" }),
  });

  // The QR has to exist before the print window can copy it, and it encodes
  // the UHID, which is only known once the card data arrives. So the fetch
  // sets state, React renders the code, and this fires on the frame after —
  // window.print is an external system, which is the case the useEffect
  // policy exists for.
  useEffect(() => {
    if (!pending) return;
    openPrintWindow(pending, cardRef.current?.innerHTML ?? "");
    setPending(null);
  }, [pending]);

  if (!canPrint) return null;

  return (
    <>
      <Button
        tone="secondary"
        leftSection={<IconPrinter size={14} />}
        loading={fetchCard.isPending || pending !== null}
        onClick={() => fetchCard.mutate()}
      >
        Print Card
      </Button>
      {/* Encodes the UHID, not the internal id. A scanner drops what it reads
          into a search box, and every search on this path — lab worklist,
          patient directory, pharmacy — matches UHID, phone and name. A QR
          carrying a UUID would scan cleanly and find nothing, which is worse
          than no QR at all because it looks like it worked. */}
      <div ref={cardRef} style={{ display: "none" }} aria-hidden="true">
        {pending && <QRCodeSVG value={pending.uhid} size={96} level="M" />}
      </div>
    </>
  );
}

/**
 * Escapes text before it is written into the print document.
 *
 * A patient's name is untrusted input that reaches this as raw HTML, and
 * `O'Brien & Sons` must print as itself rather than as broken markup.
 */
function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintWindow(data: PatientCardPrintData, qrSvg: string) {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    toast.error("Allow pop-ups for this site to print the card", {
      title: "The print window was blocked",
    });
    return;
  }

  // The age line only appears when there is one. A card reading "— yrs" looks
  // like a fault in the card rather than an absent date of birth.
  const ageLine = [data.age, data.gender].filter(Boolean).join(" · ");

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Patient card ${esc(data.uhid)}</title>
    <style>
      /* Continuous roll: the height is whatever the card needs, and a fixed
         height would eject blank paper after every card. */
      @page { size: ${ROLL_WIDTH_MM}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 2mm;
        width: ${PRINT_WIDTH_MM}mm;
        /* Thermal heads render a monospace-ish sans most reliably; hairlines
           and light greys do not survive at all, so everything here is solid
           black on white. */
        font-family: Arial, Helvetica, sans-serif;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .uhid {
        font-size: 15pt;
        font-weight: 700;
        letter-spacing: .04em;
        font-family: "Courier New", monospace;
        margin: 0 0 1mm;
      }
      .name { font-size: 11pt; font-weight: 700; line-height: 1.15; margin: 0 0 1mm; }
      .meta { font-size: 8pt; line-height: 1.35; margin: 0; }
      .qr { text-align: center; margin: 2mm 0 1mm; }
      .qr svg { width: 26mm; height: 26mm; }
      .rule { border-top: 1px dashed #000; margin: 2mm 0; }
      .hospital { font-size: 7pt; text-align: center; margin: 0; }
    </style>
  </head>
  <body>
    <p class="uhid">${esc(data.uhid)}</p>
    <p class="name">${esc(data.patient_name)}</p>
    <p class="meta">
      ${esc(ageLine)}${data.date_of_birth ? `<br/>DOB ${esc(data.date_of_birth)}` : ""}
      <br/>${esc(data.phone)}
    </p>
    <div class="qr">${qrSvg}</div>
    <div class="rule"></div>
    <p class="hospital">Registered ${esc(data.registered_at)}</p>
    <script>
      window.onload = function () {
        window.print();
        window.close();
      };
    </script>
  </body>
</html>`);
  win.document.close();
}
