import { Box } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { Button, Modal } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";
import { dosesFreqCode, type FormularyDrug, type RxItem, repeatLabel } from "./rxModel";

interface Props {
  opened: boolean;
  onClose: () => void;
  encounterId: string;
  items: RxItem[];
  formularyById: Record<string, FormularyDrug>;
  patientName: string;
  uhid: string;
}

/** Inline CSS for the A4 — used in the modal preview AND the print window, so
 *  what's previewed is exactly what prints (print window has no module CSS). */
const RX_PRINT_CSS = `
.rxp { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #161616; font-size: 12.5px; }
.rxp-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #161616; padding-bottom: 10px; }
.rxp-hosp { font-size: 18px; font-weight: 700; }
.rxp-hosp-sub { font-size: 11px; color: #525252; margin-top: 2px; }
.rxp-doc { text-align: right; font-size: 11px; color: #525252; }
.rxp-doc b { display: block; font-size: 13px; color: #161616; }
.rxp-pt { display: flex; justify-content: space-between; gap: 16px; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px 12px; margin: 14px 0; font-size: 12px; }
.rxp-pt span { color: #525252; }
.rxp-pt b { color: #161616; }
.rxp-dx { margin: 10px 0; font-size: 12.5px; }
.rxp-dx b { color: #525252; font-weight: 600; }
.rxp-xband { background: #fff1f1; border: 1px solid #da1e28; color: #a2191f; font-weight: 600; font-size: 11px; padding: 5px 10px; border-radius: 4px; margin: 8px 0; }
.rxp-rx { font-family: 'IBM Plex Serif', Georgia, serif; font-size: 26px; font-weight: 700; margin: 6px 0; }
table.rxp-tbl { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
table.rxp-tbl th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #161616; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #525252; }
table.rxp-tbl td { padding: 7px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
.rxp-drug b { font-weight: 600; }
.rxp-flag { display: inline-block; font-size: 8.5px; font-weight: 700; padding: 1px 5px; border-radius: 980px; background: #fff1f1; color: #a2191f; margin-left: 5px; letter-spacing: 0.03em; }
.rxp-salt { font-size: 10px; color: #8d8d8d; font-family: 'IBM Plex Mono', monospace; }
.rxp-advice { font-size: 11.5px; color: #525252; margin: 8px 0; }
.rxp-foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; }
.rxp-sign { text-align: center; font-size: 11px; color: #525252; }
.rxp-sign-line { width: 200px; border-top: 1px solid #161616; padding-top: 4px; }
.rxp-fine { font-size: 9px; color: #8d8d8d; margin-top: 8px; }
${copyPrintStyles()}
@media print { body { padding: 0; } }
`;

function freqLabel(it: RxItem): string {
  if (it.sos) return "SOS";
  const code = dosesFreqCode(it.doses, false);
  const times = it.doses.map((d) => d.time).join(" · ");
  const cad = it.repeat && it.repeat.type !== "daily" ? ` · ${repeatLabel(it.repeat)}` : "";
  return `${code}${times ? ` (${times})` : ""}${cad}`;
}
function durationLabel(it: RxItem): string {
  if (it.ongoing) return "Continue";
  if (it.sos) return "PRN";
  return `${it.days} day${it.days === 1 ? "" : "s"}`;
}

/** rx-suite A4 prescription — letterhead, Dx, Rx chart with schedule chips,
 *  advice, doctor registration, digital-sign line + verify QR. */
export function RxPrint({
  opened,
  onClose,
  encounterId,
  items,
  formularyById,
  patientName,
  uhid,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["opd-prescription-print-data", encounterId],
    queryFn: () => opdService.getOpdPrescriptionPrintData(encounterId),
    enabled: opened,
  });

  const hasControlled = items.some((it) => {
    const d = formularyById[it.id];
    return d?.controlled || d?.schedule === "X" || d?.schedule === "H1";
  });
  const verifyUrl = `${window.location.origin}/verify/rx/${encounterId}`;
  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>Prescription — ${patientName}</title>` +
        `<style>* { margin:0; padding:0; box-sizing:border-box; } body { padding: 24px; } ${RX_PRINT_CSS}</style>` +
        `</head><body>${buildCopyPrintHtml(content.innerHTML, PRINT_COPY_PACKETS.prescription)}` +
        `<script>window.onload=function(){window.print();window.close();}</script></body></html>`,
    );
    win.document.close();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Prescription preview" size="xl">
      <style>{RX_PRINT_CSS}</style>
      <Box ref={printRef} className="rxp">
        <Box className="rxp-head">
          <Box>
            <Box className="rxp-hosp">{data?.hospital_name ?? "Hospital"}</Box>
            <Box className="rxp-hosp-sub">
              {[data?.hospital_address, data?.hospital_phone].filter(Boolean).join(" · ")}
            </Box>
          </Box>
          <Box className="rxp-doc">
            <b>{data?.doctor_name ?? "—"}</b>
            {data?.doctor_qualification ?? ""}
            {data?.doctor_registration ? ` · Reg. ${data.doctor_registration}` : ""}
            {data?.department ? <Box>{data.department}</Box> : null}
          </Box>
        </Box>

        <Box className="rxp-pt">
          <Box>
            <span>Patient</span> <b>{data?.patient_name ?? patientName}</b>
            {data?.gender ? ` · ${data.gender}` : ""}
            {data?.age ? ` · ${data.age}` : ""}
          </Box>
          <Box>
            <span>UHID</span> <b>{data?.uhid ?? uhid}</b> · {date}
          </Box>
        </Box>

        {data?.diagnosis && data.diagnosis.length > 0 && (
          <Box className="rxp-dx">
            <b>Diagnosis:</b> {data.diagnosis.join(", ")}
          </Box>
        )}

        {hasControlled && (
          <Box className="rxp-xband">
            Contains Schedule X / H1 / NDPS controlled drug — written Rx + register entry required.
          </Box>
        )}

        <Box className="rxp-rx">℞</Box>
        <table className="rxp-tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Medication</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Timing</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const d = formularyById[it.id];
              return (
                <tr key={it.uid}>
                  <td>{String(i + 1).padStart(2, "0")}</td>
                  <td className="rxp-drug">
                    <b>
                      {it.form ? `${it.form}. ` : ""}
                      {it.name}
                    </b>
                    {(d?.schedule === "X" || d?.schedule === "H1") && (
                      <span className="rxp-flag">{d.schedule}</span>
                    )}
                    {d?.controlled && <span className="rxp-flag">NDPS</span>}
                    {d?.salt && <Box className="rxp-salt">{d.salt}</Box>}
                  </td>
                  <td>{it.strength}</td>
                  <td>{freqLabel(it)}</td>
                  <td>{durationLabel(it)}</td>
                  <td>{it.sos ? it.note || "as needed" : it.food || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data?.advice && <Box className="rxp-advice">Advice: {data.advice}</Box>}
        {(data?.follow_up_date || data?.follow_up_instructions) && (
          <Box className="rxp-advice">
            Follow-up: {data.follow_up_instructions ?? ""}
            {data.follow_up_date ? ` (${data.follow_up_date})` : ""}
          </Box>
        )}

        <Box className="rxp-foot">
          <Box>
            <QRCodeSVG value={verifyUrl} size={72} />
            <Box className="rxp-fine">Scan to verify · valid for one dispense unless stated</Box>
          </Box>
          <Box className="rxp-sign">
            <Box className="rxp-sign-line">
              {data?.doctor_name ?? "Prescriber"}
              <Box>Signature &amp; seal</Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box mt="md" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button tone="ghost" onClick={onClose}>
          Close
        </Button>
        <Button tone="primary" onClick={handlePrint} disabled={items.length === 0}>
          Print
        </Button>
      </Box>
    </Modal>
  );
}
