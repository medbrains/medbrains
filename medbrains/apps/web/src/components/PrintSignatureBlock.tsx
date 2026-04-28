/**
 * PrintSignatureBlock — renders digital signature(s) on printed
 * documents (prescriptions, lab reports, certificates, etc.).
 *
 * Two presentation paths:
 *   1. signatures present → image overlay + name + display_block +
 *      verify_ref footer, multi-signer aware
 *   2. signatures empty → "DRAFT — UNSIGNED" watermark, prevents
 *      mistakenly relying on an unsigned document
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §2.4 (visual signature
 * stamping on PDFs).
 */
import type { PrintSignatureData } from "@medbrains/types";

interface PrintSignatureBlockProps {
  signatures: PrintSignatureData[] | null | undefined;
  /** Override label shown above the signatures (e.g., "Pathologist", "Surgeon"). */
  label?: string;
  /** Show "DRAFT — UNSIGNED" watermark when empty. Default true. */
  showUnsignedWatermark?: boolean;
}

export function PrintSignatureBlock({
  signatures,
  label,
  showUnsignedWatermark = true,
}: PrintSignatureBlockProps) {
  const sigs = signatures ?? [];
  if (sigs.length === 0) {
    if (!showUnsignedWatermark) return null;
    return (
      <div
        style={{
          marginTop: 24,
          padding: "12px 16px",
          border: "2px dashed #ef4444",
          background: "rgba(239, 68, 68, 0.05)",
          textAlign: "center",
          fontFamily: "monospace",
          color: "#991b1b",
          fontSize: 11,
          letterSpacing: "0.1em",
        }}
      >
        DRAFT — UNSIGNED · NOT FOR LEGAL OR CLINICAL USE
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      {label && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#666",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {sigs.map((sig, idx) => (
          <SingleSignature key={`${sig.verify_ref}-${idx}`} sig={sig} index={idx} />
        ))}
      </div>
    </div>
  );
}

function SingleSignature({ sig, index }: { sig: PrintSignatureData; index: number }) {
  const role = index === 0 ? "Primary" : `Co-signer ${index}`;
  const dt = new Date(sig.signed_at);
  const formattedDate = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const legalBorder = legalBorderColor(sig.legal_class);

  return (
    <div
      style={{
        minWidth: 200,
        flex: "0 1 240px",
        borderTop: `2px solid ${legalBorder}`,
        paddingTop: 6,
      }}
    >
      {/* Visual signature image overlay (the scanned signature PNG) */}
      {sig.display_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sig.display_image_url}
          alt="Digital signature"
          style={{
            maxHeight: 56,
            maxWidth: 200,
            objectFit: "contain",
            display: "block",
            marginBottom: 4,
          }}
        />
      ) : (
        // No image — render cursive name fallback
        <div
          style={{
            fontFamily: "'Brush Script MT', cursive",
            fontSize: 24,
            color: "#1f4332",
            lineHeight: 1.1,
            marginBottom: 4,
            minHeight: 32,
          }}
        >
          {sig.signer_name ?? "—"}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 600 }}>
        {sig.signer_name ?? "Doctor"}
      </div>
      <div style={{ fontSize: 10, color: "#555" }}>
        {role} • {formattedDate}
      </div>
      {sig.display_block && (
        <div
          style={{
            fontSize: 9,
            color: "#666",
            marginTop: 2,
            fontFamily: "monospace",
            lineHeight: 1.2,
          }}
        >
          {sig.display_block}
        </div>
      )}
      <div
        style={{
          fontSize: 8,
          color: "#888",
          fontFamily: "monospace",
          marginTop: 2,
        }}
      >
        Verify: {sig.verify_ref.slice(0, 12)}…
      </div>
      <LegalClassBadge legalClass={sig.legal_class} />
    </div>
  );
}

function LegalClassBadge({ legalClass }: { legalClass: string }) {
  const { label, bg, color } = (() => {
    switch (legalClass) {
      case "medico_legal":
        return { label: "MEDICO-LEGAL", bg: "#fee2e2", color: "#991b1b" };
      case "statutory_export":
        return { label: "STATUTORY", bg: "#fef3c7", color: "#92400e" };
      case "clinical":
        return { label: "CLINICAL", bg: "#dbeafe", color: "#1e40af" };
      default:
        return { label: legalClass.toUpperCase(), bg: "#f3f4f6", color: "#374151" };
    }
  })();
  return (
    <div
      style={{
        display: "inline-block",
        marginTop: 4,
        padding: "1px 6px",
        background: bg,
        color,
        fontSize: 8,
        fontWeight: 600,
        letterSpacing: "0.06em",
        borderRadius: 2,
      }}
    >
      {label}
    </div>
  );
}

function legalBorderColor(legalClass: string): string {
  switch (legalClass) {
    case "medico_legal":
      return "#dc2626";
    case "statutory_export":
      return "#d97706";
    case "clinical":
      return "#2563eb";
    default:
      return "#374151";
  }
}

/**
 * Inline HTML version for legacy iframe/print-on-paper flows that pipe
 * raw HTML into a new window. Use when a React component can't be
 * mounted in the print target.
 */
export function renderSignatureBlockHtml(
  signatures: PrintSignatureData[] | null | undefined,
  label?: string,
): string {
  const sigs = signatures ?? [];
  if (sigs.length === 0) {
    return `<div class="sig-unsigned">DRAFT — UNSIGNED · NOT FOR LEGAL OR CLINICAL USE</div>`;
  }
  const items = sigs
    .map((s, i) => {
      const role = i === 0 ? "Primary" : `Co-signer ${i}`;
      const dt = new Date(s.signed_at);
      const date = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      const img = s.display_image_url
        ? `<img src="${s.display_image_url}" alt="signature" class="sig-img" />`
        : `<div class="sig-cursive">${escapeHtml(s.signer_name ?? "—")}</div>`;
      const block = s.display_block
        ? `<div class="sig-block">${escapeHtml(s.display_block)}</div>`
        : "";
      const badge = `<span class="sig-badge sig-${s.legal_class}">${legalLabel(
        s.legal_class,
      )}</span>`;
      return `
        <div class="sig-item sig-legal-${s.legal_class}">
          ${img}
          <div class="sig-name">${escapeHtml(s.signer_name ?? "Doctor")}</div>
          <div class="sig-role">${role} • ${date}</div>
          ${block}
          <div class="sig-verify">Verify: ${s.verify_ref.slice(0, 12)}…</div>
          ${badge}
        </div>`;
    })
    .join("");
  return `${label ? `<div class="sig-label">${escapeHtml(label)}</div>` : ""}<div class="sig-block-row">${items}</div>`;
}

export const SIGNATURE_BLOCK_CSS = `
  .sig-block-row { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 24px; }
  .sig-item { min-width: 200px; flex: 0 1 240px; border-top: 2px solid #374151; padding-top: 6px; }
  .sig-legal-medico_legal { border-top-color: #dc2626; }
  .sig-legal-statutory_export { border-top-color: #d97706; }
  .sig-legal-clinical { border-top-color: #2563eb; }
  .sig-img { max-height: 56px; max-width: 200px; display: block; margin-bottom: 4px; object-fit: contain; }
  .sig-cursive { font-family: 'Brush Script MT', cursive; font-size: 24px; color: #1f4332; line-height: 1.1; min-height: 32px; margin-bottom: 4px; }
  .sig-name { font-size: 11px; font-weight: 600; }
  .sig-role { font-size: 10px; color: #555; }
  .sig-block { font-size: 9px; color: #666; margin-top: 2px; font-family: monospace; line-height: 1.2; }
  .sig-verify { font-size: 8px; color: #888; font-family: monospace; margin-top: 2px; }
  .sig-badge { display: inline-block; margin-top: 4px; padding: 1px 6px; font-size: 8px; font-weight: 600; letter-spacing: 0.06em; border-radius: 2px; }
  .sig-medico_legal { background: #fee2e2; color: #991b1b; }
  .sig-statutory_export { background: #fef3c7; color: #92400e; }
  .sig-clinical { background: #dbeafe; color: #1e40af; }
  .sig-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 8px; }
  .sig-unsigned { margin-top: 24px; padding: 12px 16px; border: 2px dashed #ef4444; background: rgba(239,68,68,0.05); text-align: center; font-family: monospace; color: #991b1b; font-size: 11px; letter-spacing: 0.1em; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function legalLabel(legalClass: string): string {
  switch (legalClass) {
    case "medico_legal": return "MEDICO-LEGAL";
    case "statutory_export": return "STATUTORY";
    case "clinical": return "CLINICAL";
    default: return legalClass.toUpperCase();
  }
}
