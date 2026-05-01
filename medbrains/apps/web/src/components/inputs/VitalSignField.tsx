import s from "./inputs.module.scss";

interface VitalSignFieldProps {
  label: string;
  value: number | string;
  unit: string;
  rangeLabel?: string;
  /** position of marker on the threshold band, 0 to 1. */
  markerPosition?: number;
  status?: "ok" | "warn" | "crit";
  hint?: string;
}

export function VitalSignField({
  label,
  value,
  unit,
  rangeLabel,
  markerPosition,
  status = "ok",
  hint,
}: VitalSignFieldProps) {
  const cls = [s.vital, status === "warn" && s.warn, status === "crit" && s.crit]
    .filter(Boolean)
    .join(" ");
  const markerStyle =
    markerPosition !== undefined
      ? { left: `calc(14px + (100% - 28px) * ${Math.max(0, Math.min(1, markerPosition))})` }
      : undefined;

  return (
    <div>
      {(rangeLabel || label) && (
        <div className={s.vitalLbl}>
          <span className={s.nm}>{label}</span>
          {rangeLabel && <span className={s.rng}>{rangeLabel}</span>}
        </div>
      )}
      <div className={cls}>
        <span className={s.num}>{value}</span>
        <span className={s.unit}>{unit}</span>
        <span className={s.zone} />
        <span className={s.marker} style={markerStyle} />
      </div>
      {hint && (
        <div
          className={`${s.hint} ${status === "crit" ? s.err : status === "warn" ? s.cop : ""}`}
          style={{ marginTop: 6 }}
        >
          <span className={s.pip} />
          {hint}
        </div>
      )}
    </div>
  );
}
