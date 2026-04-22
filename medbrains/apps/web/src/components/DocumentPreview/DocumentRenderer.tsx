import { Button, Group } from "@mantine/core";
import { IconPrinter, IconDownload } from "@tabler/icons-react";
import { useRef, useMemo } from "react";
import classes from "./document-renderer.module.scss";

// ── Types ───────────────────────────────────────────────

interface TemplateLayout {
  name: string;
  print_format: string;
  header_layout: SectionDef[];
  body_layout: SectionDef[];
  footer_layout: SectionDef[];
  show_logo: boolean;
  show_hospital_name: boolean;
  show_hospital_address: boolean;
  show_qr_code: boolean;
  signature_blocks: SignatureBlockDef[] | null;
  font_family: string;
  font_size_pt: number;
  margin_top_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
}

interface SectionDef {
  type: string;
  title?: string;
  fields?: FieldDef[];
  columns?: ColumnDef[];
  data_key?: string;
  text?: string;
  items?: SummaryItemDef[];
  label?: string;
  value_key?: string;
  caption?: string;
}

interface FieldDef { label: string; key: string }
interface ColumnDef { header: string; key: string; flag_key?: string }
interface SummaryItemDef { label: string; key: string; is_total?: boolean }
interface SignatureBlockDef { label: string; designation?: string; key?: string }

export interface HospitalInfo {
  name: string;
  address: string;
  phone: string;
  logo_url?: string;
  registration_no?: string;
}

export interface DocumentRendererProps {
  template: TemplateLayout;
  context: Record<string, unknown>;
  hospitalInfo?: HospitalInfo;
}

// ── Helpers ─────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(text: string | undefined | null, ctx: Record<string, unknown>): string {
  if (!text) return "";
  return text.replace(/\{\{(\w[\w.]*)\}\}/g, (_m, key: string) => {
    const val = getNestedValue(ctx, key);
    return val == null ? "" : String(val);
  });
}

function fmtVal(val: unknown): string {
  if (val == null) return "\u2014";
  if (typeof val === "string") return val || "\u2014";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ") || "\u2014";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function flagCls(flag: string | null | undefined): string | undefined {
  if (!flag) return undefined;
  const f = flag.toLowerCase();
  if (f === "critical") return classes.flagCritical;
  if (f === "high" || f === "h") return classes.flagHigh;
  if (f === "low" || f === "l") return classes.flagLow;
  return undefined;
}

// ── Field Row (reusable) ────────────────────────────────

function FieldRow({ f, ctx }: { f: FieldDef; ctx: Record<string, unknown> }) {
  return (
    <div className={classes.infoItem}>
      <span className={classes.label}>{f.label}</span>
      <span className={classes.value}>{fmtVal(getNestedValue(ctx, f.key))}</span>
    </div>
  );
}

// ── Section Renderers ───────────────────────────────────

function HospitalHeader({ info, t }: { info?: HospitalInfo; t: TemplateLayout }) {
  if (!info) return null;
  return (
    <div className={classes.hospitalHeader}>
      {t.show_logo && info.logo_url && (
        <img src={info.logo_url} alt="Logo" className={classes.hospitalLogo} />
      )}
      <div className={classes.hospitalInfo}>
        {t.show_hospital_name && <h2>{info.name}</h2>}
        {t.show_hospital_address && <p>{info.address}</p>}
        {info.phone && <p>Phone: {info.phone}</p>}
        {info.registration_no && <p>Reg. No: {info.registration_no}</p>}
      </div>
    </div>
  );
}

function PatientInfoSection({ section, ctx }: { section: SectionDef; ctx: Record<string, unknown> }) {
  return (
    <div className={classes.patientInfo}>
      {(section.fields ?? []).map((f) => <FieldRow key={f.key} f={f} ctx={ctx} />)}
    </div>
  );
}

function KeyValueSection({ section, ctx }: { section: SectionDef; ctx: Record<string, unknown> }) {
  return (
    <div className={classes.keyValueSection}>
      {section.title && <div className={classes.kvTitle}>{section.title}</div>}
      <div className={classes.kvGrid}>
        {(section.fields ?? []).map((f) => <FieldRow key={f.key} f={f} ctx={ctx} />)}
      </div>
    </div>
  );
}

function TableSection({ section, ctx }: { section: SectionDef; ctx: Record<string, unknown> }) {
  const cols = section.columns ?? [];
  const rows = (getNestedValue(ctx, section.data_key ?? "") as Record<string, unknown>[]) ?? [];
  return (
    <div>
      {section.title && <div className={classes.kvTitle}>{section.title}</div>}
      <table className={classes.docTable}>
        <thead>
          <tr>
            <th>#</th>
            {cols.map((c) => <th key={c.key}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {cols.map((c) => (
                <td key={c.key} className={c.flag_key ? flagCls(row[c.flag_key] as string) : undefined}>
                  {fmtVal(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + 1} style={{ textAlign: "center" }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummarySection({ section, ctx }: { section: SectionDef; ctx: Record<string, unknown> }) {
  return (
    <div className={classes.summarySection}>
      {section.title && <div className={classes.kvTitle}>{section.title}</div>}
      <div className={classes.summaryGrid}>
        {(section.items ?? []).map((item) => (
          <div key={item.key} className={`${classes.summaryRow} ${item.is_total ? classes.total : ""}`}>
            <span>{item.label}</span>
            <span>{fmtVal(getNestedValue(ctx, item.key))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextSection({ section, ctx }: { section: SectionDef; ctx: Record<string, unknown> }) {
  const content = section.text
    ? interpolate(section.text, ctx)
    : section.data_key
      ? fmtVal(getNestedValue(ctx, section.data_key))
      : "";
  return (
    <div className={classes.textBlock}>
      {section.title && <div className={classes.textTitle}>{section.title}</div>}
      <div>{content}</div>
    </div>
  );
}

function SignaturesSection({ blocks, ctx }: { blocks: SignatureBlockDef[]; ctx: Record<string, unknown> }) {
  return (
    <div className={classes.signaturesRow}>
      {blocks.map((blk, i) => (
        <div key={i} className={classes.signatureBlock}>
          <div className={classes.sigLine}>{blk.key ? fmtVal(getNestedValue(ctx, blk.key)) : ""}</div>
          <div className={classes.sigLabel}>{blk.label}</div>
          {blk.designation && <div className={classes.sigDesignation}>{blk.designation}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Section Router ──────────────────────────────────────

function RenderSection({
  section, ctx, hospitalInfo, template,
}: {
  section: SectionDef;
  ctx: Record<string, unknown>;
  hospitalInfo?: HospitalInfo;
  template: TemplateLayout;
}) {
  switch (section.type) {
    case "hospital_header":
      return <HospitalHeader info={hospitalInfo} t={template} />;
    case "title":
      return <div className={classes.docTitle}>{section.title ?? section.text ?? ""}</div>;
    case "patient_info":
      return <PatientInfoSection section={section} ctx={ctx} />;
    case "key_value":
      return <KeyValueSection section={section} ctx={ctx} />;
    case "table":
      return <TableSection section={section} ctx={ctx} />;
    case "summary":
      return <SummarySection section={section} ctx={ctx} />;
    case "text":
      return <TextSection section={section} ctx={ctx} />;
    case "signatures":
      return <SignaturesSection blocks={template.signature_blocks ?? []} ctx={ctx} />;
    case "qr_code":
      return template.show_qr_code ? (
        <div className={classes.qrBlock}>
          <div className={classes.qrCaption}>{section.caption ?? "Scan for verification"}</div>
        </div>
      ) : null;
    case "print_meta":
      return <div className={classes.printMeta}>Printed on: {new Date().toLocaleString()}</div>;
    default:
      return null;
  }
}

// ── Main Component ──────────────────────────────────────

export function DocumentRenderer({ template, context, hospitalInfo }: DocumentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cssVars = useMemo(
    () => ({
      "--doc-font": template.font_family || "'Times New Roman', serif",
      "--doc-font-size": `${template.font_size_pt || 11}pt`,
      "--doc-margin-top": `${template.margin_top_mm || 15}mm`,
      "--doc-margin-bottom": `${template.margin_bottom_mm || 15}mm`,
      "--doc-margin-left": `${template.margin_left_mm || 15}mm`,
      "--doc-margin-right": `${template.margin_right_mm || 15}mm`,
    }),
    [template],
  );

  const headerSections = (template.header_layout ?? []) as SectionDef[];
  const bodySections = (template.body_layout ?? []) as SectionDef[];
  const footerSections = (template.footer_layout ?? []) as SectionDef[];

  const renderSections = (sections: SectionDef[], prefix: string) =>
    sections.map((sec, i) => (
      <RenderSection
        key={`${prefix}-${i}`}
        section={sec}
        ctx={context}
        hospitalInfo={hospitalInfo}
        template={template}
      />
    ));

  return (
    <div>
      <div className={classes.screenOnly}>
        <Group gap="xs">
          <Button leftSection={<IconPrinter size={16} />} variant="light" size="xs" onClick={() => window.print()}>
            Print
          </Button>
          <Button leftSection={<IconDownload size={16} />} variant="light" size="xs" disabled>
            Download PDF
          </Button>
        </Group>
      </div>
      <div ref={containerRef} className={classes.renderer} style={cssVars as React.CSSProperties}>
        {renderSections(headerSections, "h")}
        {renderSections(bodySections, "b")}
        {renderSections(footerSections, "f")}
      </div>
    </div>
  );
}
