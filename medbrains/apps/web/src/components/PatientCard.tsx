import { Badge } from "@/components/ui";
import classes from "./PatientCard.module.scss";

export interface PatientCardField {
  label: string;
  value: string;
}

export interface PatientCardProps {
  name: string;
  uhid: string;
  /** Avatar initials; derived from the name when omitted. */
  initials?: string;
  /** Eyebrow-labelled fields (Age·Sex, Weight, Diagnosis, …). */
  fields?: PatientCardField[];
  /** Allergies rendered as red dot-badges (the safety-critical signal). */
  allergies?: string[];
  /** Right-aligned meta lines (e.g. "Rx · 20 Jun 2026", "14:38 · OPD/02"). */
  meta?: string[];
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length === 0) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

/**
 * Reusable patient header banner — initials chip, name + UHID, eyebrow-labelled
 * fields, allergies as red dot-badges, right-aligned meta. Used across all
 * patient views (OPD, IPD, pharmacy, lab, billing, prescription).
 */
export function PatientCard({
  name,
  uhid,
  initials,
  fields = [],
  allergies = [],
  meta = [],
}: PatientCardProps) {
  return (
    <div className={classes.banner}>
      <div className={classes.id}>
        <div className={classes.avatar}>{initials ?? deriveInitials(name)}</div>
        <div>
          <div className={classes.name}>{name}</div>
          <div className={classes.uhid}>{uhid}</div>
        </div>
      </div>

      {(fields.length > 0 || allergies.length > 0) && <div className={classes.divider} />}

      <div className={classes.fields}>
        {fields.map((f) => (
          <div className={classes.field} key={f.label}>
            <div className={classes.eyebrow}>{f.label}</div>
            <div className={classes.value}>{f.value}</div>
          </div>
        ))}
        {allergies.length > 0 && (
          <div className={classes.field}>
            <div className={classes.eyebrow}>Allergies</div>
            <div className={classes.allergyRow}>
              {allergies.map((a) => (
                <Badge key={a} tone="danger" size="sm">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {meta.length > 0 && (
        <div className={classes.meta}>
          {meta.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>
      )}
    </div>
  );
}
