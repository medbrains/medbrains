/**
 * Signature ECG heartbeat glyph — the app's cardiac-monitor motif distilled
 * to a small, crisp icon. `currentColor` so it inherits whatever colour the
 * host gives it (e.g. white inside a toast's tone chip). Subtle one-shot
 * draw on mount; respects prefers-reduced-motion.
 */
export function EcgGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>ECG</title>
      <polyline
        points="2,13 7,13 9,13 11,7 13,18 15,10 16,13 22,13"
        style={{
          strokeDasharray: 44,
          strokeDashoffset: 44,
          animation: "mb-ecg-draw 0.6s ease-out forwards",
        }}
      />
      <style>{`
        @keyframes mb-ecg-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          polyline { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
    </svg>
  );
}
