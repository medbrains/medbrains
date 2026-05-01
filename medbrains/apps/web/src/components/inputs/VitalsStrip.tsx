import type { CSSProperties } from "react";
import s from "./inputs.module.scss";

export interface VitalCell {
  label: string;
  reference?: string;
  value?: string | number | null;
  unit: string;
  status?: "empty" | "entered" | "warn" | "crit";
}

interface VitalsStripProps {
  cells: VitalCell[];
}

export function VitalsStrip({ cells }: VitalsStripProps) {
  const style = { "--cols": cells.length } as CSSProperties;

  return (
    <div className={s.vitalsStrip} style={style}>
      {cells.map((c) => {
        const isEmpty = c.status === "empty" || c.value === null || c.value === undefined;
        const status: VitalCell["status"] = isEmpty ? "empty" : (c.status ?? "entered");
        const cls = [
          s.vc,
          status === "entered" && s.entered,
          status === "warn" && s.warn,
          status === "crit" && s.crit,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div className={cls} key={c.label}>
            <div className={s.k}>
              <span>{c.label}</span>
              {c.reference && <span className={s.ref}>{c.reference}</span>}
            </div>
            <div className={s.field}>
              <span className={isEmpty ? `${s.v} ${s.empty}` : s.v}>{isEmpty ? "—" : c.value}</span>
              <span className={s.u}>{c.unit}</span>
            </div>
            {status === "warn" && <div className={s.pulse} />}
          </div>
        );
      })}
    </div>
  );
}
