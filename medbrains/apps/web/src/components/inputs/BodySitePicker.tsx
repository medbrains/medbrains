import { useState } from "react";
import s from "./inputs.module.scss";

export type AnatomicPrefix =
  | "Anterior"
  | "Posterior"
  | "Lateral"
  | "Medial"
  | "Superior"
  | "Inferior";

const PREFIX_KEYS: Record<AnatomicPrefix, string> = {
  Anterior: "A",
  Posterior: "P",
  Lateral: "L",
  Medial: "M",
  Superior: "S",
  Inferior: "I",
};

interface BodySitePickerProps {
  prefix: AnatomicPrefix;
  region: string;
  onPrefixChange: (prefix: AnatomicPrefix) => void;
  onRegionChange: (region: string) => void;
  prefixes?: AnatomicPrefix[];
  placeholder?: string;
}

export function BodySitePicker({
  prefix,
  region,
  onPrefixChange,
  onRegionChange,
  prefixes = ["Anterior", "Posterior", "Lateral", "Medial", "Superior", "Inferior"],
  placeholder = "region…",
}: BodySitePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={s.bsiteWrap}>
      <div className={s.bsite}>
        <button
          type="button"
          className={s.pre}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {prefix} <span className={s.chev} />
        </button>
        <input
          value={region}
          placeholder={placeholder}
          onChange={(e) => onRegionChange(e.target.value)}
        />
      </div>
      {open && (
        <div className={s.menu} role="menu">
          {prefixes.map((p) => (
            <button
              type="button"
              key={p}
              className={`${s.item}${p === prefix ? ` ${s.on}` : ""}`}
              onClick={() => {
                onPrefixChange(p);
                setOpen(false);
              }}
              role="menuitem"
            >
              {p} <span className={s.k}>{PREFIX_KEYS[p]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
