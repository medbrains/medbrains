import s from "./inputs.module.scss";

interface ShiftTimePickerProps {
  /** time in 24h "HH:MM" format. */
  value: string;
}

function timeToFraction(value: string): number {
  const parts = value.split(":");
  const h = Number.parseInt(parts[0] ?? "0", 10);
  const m = Number.parseInt(parts[1] ?? "0", 10);
  if (Number.isNaN(h)) return 0;
  const minutes = h * 60 + (Number.isNaN(m) ? 0 : m);
  return Math.max(0, Math.min(1, minutes / (24 * 60)));
}

export function ShiftTimePicker({ value }: ShiftTimePickerProps) {
  const pct = `${(timeToFraction(value) * 100).toFixed(2)}%`;

  return (
    <div className={s.timeline}>
      <div className={s.scale}>
        <div className={s.track} />
        <div className={`${s.shiftBand} ${s.day}`} style={{ left: "25%", width: "33.33%" }} />
        <div className={`${s.shiftBand} ${s.eve}`} style={{ left: "58.33%", width: "33.33%" }} />
        <div className={`${s.shiftBand} ${s.night}`} style={{ left: "0%", width: "25%" }} />
        <div className={`${s.shiftBand} ${s.night}`} style={{ left: "91.66%", width: "8.33%" }} />

        <div className={`${s.tick} ${s.major}`} style={{ left: "0%" }} />
        <div className={s.tickLbl} style={{ left: "0%" }}>
          00
        </div>
        <div className={`${s.tick} ${s.major}`} style={{ left: "25%" }} />
        <div className={s.tickLbl} style={{ left: "25%" }}>
          06
        </div>
        <div className={s.tick} style={{ left: "50%" }} />
        <div className={s.tickLbl} style={{ left: "50%" }}>
          12
        </div>
        <div className={`${s.tick} ${s.major}`} style={{ left: "58.33%" }} />
        <div className={s.tickLbl} style={{ left: "58.33%" }}>
          14
        </div>
        <div className={s.tick} style={{ left: "75%" }} />
        <div className={s.tickLbl} style={{ left: "75%" }}>
          18
        </div>
        <div className={`${s.tick} ${s.major}`} style={{ left: "91.66%" }} />
        <div className={s.tickLbl} style={{ left: "91.66%" }}>
          22
        </div>

        <div className={s.marker} style={{ left: pct }}>
          <div className={s.val}>{value}</div>
          <div className={s.pin} />
          <div className={s.head} />
        </div>
      </div>
      <div className={s.timelineLegend}>
        <span className={`${s.l} ${s.day}`}>Day · 06–14</span>
        <span className={`${s.l} ${s.eve}`}>Evening · 14–22</span>
        <span className={`${s.l} ${s.night}`}>Night · 22–06</span>
      </div>
    </div>
  );
}
