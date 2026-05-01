import type { ChangeEvent } from "react";
import s from "./inputs.module.scss";

interface AllergyFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  badgeLabel?: string;
  severity?: "watch" | "blocking";
  required?: boolean;
  hint?: string;
}

export function AllergyField({
  value,
  onChange,
  placeholder,
  badgeLabel,
  severity = "watch",
  hint,
}: AllergyFieldProps) {
  const cls = `${s.danger}${severity === "blocking" ? ` ${s.severe}` : ""}`;

  return (
    <div>
      <div className={cls}>
        <span className={s.markerBar} />
        <input
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
        />
        {badgeLabel && <span className={s.badge}>{badgeLabel}</span>}
      </div>
      {hint && (
        <div
          className={`${s.hint} ${severity === "blocking" ? s.err : s.cop}`}
          style={{ marginTop: 6 }}
        >
          <span className={s.pip} />
          {hint}
        </div>
      )}
    </div>
  );
}
