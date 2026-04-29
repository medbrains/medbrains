/** Tiny SVG sparkline — used in Pipeline Ledger. */
interface SparklineProps {
  data: number[];
  fail?: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ data, fail, width = 104, height = 32 }: SparklineProps) {
  const max = Math.max(1, ...data, ...(fail ?? []));
  const step = width / Math.max(1, data.length - 1);
  const toY = (v: number) => height - (v / max) * (height - 2) - 1;

  const points = data.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      role="img"
      aria-label="Sparkline chart"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--fc-brand)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const cx = i * step;
        return <circle key={`${cx}-${v}`} cx={cx} cy={toY(v)} r="1.4" fill="var(--fc-brand)" />;
      })}
      {(fail ?? []).map((v, i) => {
        if (v <= 0) return null;
        const x = i * step - 1.5;
        return (
          <rect
            key={`fail-${x}-${v}`}
            x={x}
            y={toY(v)}
            width="3"
            height={(v / max) * (height - 2)}
            fill="var(--mb-danger-accent)"
            rx="1"
          />
        );
      })}
    </svg>
  );
}
