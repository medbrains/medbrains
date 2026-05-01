import s from "./inputs.module.scss";

interface UhidDisplayProps {
  prefix?: string;
  year?: number | string;
  serial: string;
  showCursor?: boolean;
  className?: string;
}

export function UhidDisplay({
  prefix = "UH",
  year,
  serial,
  showCursor = false,
  className,
}: UhidDisplayProps) {
  const yr = year ?? new Date().getFullYear();
  return (
    <div className={className ? `${s.uhid} ${className}` : s.uhid}>
      <span className={`${s.seg} ${s.fixed}`}>{prefix}</span>
      <span className={`${s.seg} ${s.fixed}`}>{yr}</span>
      <span className={`${s.seg} ${s.live}`}>
        {serial}
        {showCursor && <span className={s.cur} />}
      </span>
    </div>
  );
}
