import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import styles from "./TopProgressBar.module.scss";

// ── Trace builder (pure, cacheable) ────────────────────────────

// Single clean PQRST beat at given x position
function beat(x: number): string {
  return (
    // P wave (gentle)
    `${x},15 ${x + 3},14 ${x + 6},13 ${x + 8},13 ${x + 10},14 ${x + 12},15 ` +
    // PR flat
    `${x + 15},15 ${x + 18},15 ` +
    // QRS — single clean spike (not jagged)
    `${x + 19},15.5 ${x + 20},16 ${x + 21},12 ${x + 22},2 ${x + 23},3 ` +
    `${x + 24},20 ${x + 25},21 ${x + 26},18 ${x + 27},15 ` +
    // ST flat
    `${x + 30},15 ${x + 35},15 ` +
    // T wave (smooth rounded)
    `${x + 37},15 ${x + 40},14 ${x + 43},12.5 ${x + 45},12 ${x + 47},12.5 ${x + 50},14 ${x + 52},15`
  );
}

const traceCache = new Map<number, string>();

function getTrace(w: number): string {
  const cached = traceCache.get(w);
  if (cached) return cached;

  // Single beat centered at 50% of screen
  const center = w / 2 - 26;

  const trace =
    `0,15 ${center - 5},15 ` +
    beat(center) +
    ` ${center + 56},15 ${w},15`;

  traceCache.set(w, trace);
  return trace;
}

// ── Constants ──────────────────────────────────────────────────

const SCAN_W = 60;
const DURATION = 3500;
const TRACE_COLOR = "#34d399";

// ── Component ──────────────────────────────────────────────────

function TopProgressBarInner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const w = window.innerWidth;
    widthRef.current = w;
    setWidth(w);
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);

    const w = window.innerWidth;
    if (w !== widthRef.current) {
      widthRef.current = w;
      setWidth(w);
    }

    setVisible(true);
    timerRef.current = setTimeout(hide, DURATION);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [location.pathname, hide]);

  // Memoize all derived values
  const trace = useMemo(() => (width > 0 ? getTrace(width) : ""), [width]);

  // Single beat center position
  const beatCenter = width / 2 - 4;

  const scanStyle = useMemo(() => ({
    "--scan-start": `${-SCAN_W}px`,
    "--beat-approach": `${beatCenter - 40}px`,
    "--beat-pass": `${beatCenter + 10}px`,
    "--scan-end": `${width + SCAN_W}px`,
  } as React.CSSProperties), [beatCenter, width]);

  const pathStyle = useMemo(
    () => ({ "--path-len": `${width * 1.2}` } as React.CSSProperties),
    [width],
  );

  const viewBox = `0 0 ${width} 24`;

  if (!visible || width === 0) return null;

  return (
    <div className={styles.track}>
      <div className={styles.baseline} />

      {/* Glowing dot at spike start */}
      <div
        className={styles.glowDot}
        style={{ left: `${beatCenter}px` }}
      />

      <svg className={styles.traceSvg} viewBox={viewBox} preserveAspectRatio="none" fill="none">
        <defs>
          <mask id="scanMask">
            <rect
              className={styles.scanWindow}
              y="0"
              width={SCAN_W}
              height="24"
              fill="white"
              style={scanStyle}
            />
          </mask>
        </defs>

        <polyline
          className={styles.trailTrace}
          stroke={TRACE_COLOR}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={trace}
          style={pathStyle}
        />

        <polyline
          className={styles.activeTrace}
          stroke={TRACE_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          mask="url(#scanMask)"
          points={trace}
        />
      </svg>
    </div>
  );
}

export const TopProgressBar = memo(TopProgressBarInner);
