import { useState } from "react";
import s from "./components-inputs.module.scss";

const cx = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(" ");

interface UserIconProps {
  className?: string;
}

function UserIcon({ className }: UserIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      role="img"
      aria-label="User"
    >
      <title>User</title>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

function LockIcon({ className }: UserIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      role="img"
      aria-label="Lock"
    >
      <title>Lock</title>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function SearchIcon({ className }: UserIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      role="img"
      aria-label="Search"
    >
      <title>Search</title>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

type DeptKey = "all" | "opd" | "ipd" | "er";
type SexKey = "female" | "male" | "other";
type ModeKey = "inpatient" | "outpatient";

export function ComponentsInputsPage() {
  const [dept, setDept] = useState<DeptKey>("all");
  const [sex, setSex] = useState<SexKey>("female");
  const [mode, setMode] = useState<ModeKey>("inpatient");
  const [onCall, setOnCall] = useState(true);
  const [consents, setConsents] = useState({ treatment: true, research: false });
  const [confirms, setConfirms] = useState({ signed: true, readback: true, briefed: false });

  return (
    <div className={s.page}>
      <div className={s.top}>
        <div>
          <h1>
            Inputs <em>that know what they capture</em>
          </h1>
          <div className={s.topSub}>
            Six specialised inputs and two form layouts. Each carries domain shape — a UHID looks
            like a UHID; a vital looks like a vital. Generic fields are kept for utility.
          </div>
        </div>
        <div className={s.meta}>Forest + Copper · v0.3</div>
      </div>

      {/* Section i — specialised */}
      <section className={s.section}>
        <div className={s.secH}>
          <span className={s.num}>i</span>
          <h2>Specialised — domain-aware fields</h2>
          <span className={s.tag}>6 patterns</span>
        </div>
        <div className={s.secNote}>
          These extend, not replace, standard text inputs. Use them where the data has structure the
          user can see (UHID, vitals, drug, time-of-day, body-site, allergy). The shape of the input{" "}
          <b>teaches</b> the user what shape the data takes.
        </div>

        {/* 1 · UHID */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>1 · Hospital ID (UHID)</span>
            <span className={s.m}>segmented · auto-advance</span>
          </div>
          <div className={s.cardB}>
            <div className={s.lbl}>Patient UHID</div>
            <div className={s.uhid}>
              <span className={cx(s.seg, s.fixed)}>UH</span>
              <span className={cx(s.seg, s.fixed)}>2026</span>
              <span className={cx(s.seg, s.live)}>
                00342
                <span className={s.cur} />
              </span>
            </div>
            <div className={cx(s.hint, s.cop)}>
              <span className={s.pip} />
              Fixed prefix · year auto-stamped · check-digit validated silently
            </div>
          </div>
          <div className={s.cardF}>
            Fixed segments are <b>read-only</b> chrome — only the live segment accepts keystrokes.
            Tab advances; backspace at position 0 retreats. Copper underline on the live segment
            replaces the generic focus ring.
          </div>
        </div>

        {/* 2 · Vitals */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>2 · Vital sign — value + reference zone</span>
            <span className={s.m}>live colour by threshold</span>
          </div>
          <div className={s.cardB}>
            <div className={s.row3}>
              <div>
                <div className={s.vitalLbl}>
                  <span className={s.nm}>Systolic BP</span>
                  <span className={s.rng}>90–140 mmHg</span>
                </div>
                <div className={cx(s.vital, s.sys)}>
                  <span className={s.num}>128</span>
                  <span className={s.unit}>mmHg</span>
                  <span className={s.zone} />
                  <span className={s.marker} />
                </div>
              </div>
              <div>
                <div className={s.vitalLbl}>
                  <span className={s.nm}>Heart rate</span>
                  <span className={s.rng}>60–100 bpm</span>
                </div>
                <div className={cx(s.vital, s.hr, s.warn)}>
                  <span className={s.num}>112</span>
                  <span className={s.unit}>bpm</span>
                  <span className={s.zone} />
                  <span className={s.marker} />
                </div>
                <div className={cx(s.hint, s.cop)} style={{ marginTop: 6 }}>
                  <span className={s.pip} />
                  Above reference — tagged for clinician review
                </div>
              </div>
              <div>
                <div className={s.vitalLbl}>
                  <span className={s.nm}>SpO₂</span>
                  <span className={s.rng}>95–100 %</span>
                </div>
                <div className={cx(s.vital, s.spo2)}>
                  <span className={s.num}>98</span>
                  <span className={s.unit}>%</span>
                  <span className={s.zone} />
                  <span className={s.marker} />
                </div>
              </div>
            </div>
          </div>
          <div className={s.cardF}>
            Reference zone is rendered as a multi-stop gradient (low / healthy / watch / high /
            critical). Marker position derives from the value; colour escalates only when crossing
            thresholds — quiet most of the time.
          </div>
        </div>

        {/* 3 · Drug */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>3 · Prescription line — composed paragraph</span>
            <span className={s.m}>tokens read as a sentence</span>
          </div>
          <div className={s.cardB}>
            <div className={s.lbl}>Drug · dose · frequency · duration</div>
            <div className={s.drugInput}>
              <span className={cx(s.tok, s.drug)}>Amoxicillin</span>
              <span className={cx(s.tok, s.dose)}>500 mg</span>
              <span className={s.conn}>·</span>
              <span className={cx(s.tok, s.freq)}>1–0–1</span>
              <span className={s.conn}>for</span>
              <span className={cx(s.tok, s.dur)}>5 d</span>
              <span className={s.conn}>— after meals</span>
              <span className={s.curThick} />
            </div>
            <div className={s.allergyStrip}>
              <span className={s.lab}>Allergy match</span>
              <div className={s.msg}>
                Patient has a known reaction to <b>penicillin (rash, 2024)</b>. Suggest{" "}
                <b>azithromycin 500 mg</b>.
              </div>
            </div>
          </div>
          <div className={s.cardF}>
            Tokens are typed-search results, not prose. Drug = forest, dose = copper (numeric),
            frequency &amp; duration = neutral mono. Connectors stay italic-serif so the line still
            reads as a sentence. Allergy strip auto-renders inline; never modal.
          </div>
        </div>

        {/* 4 · Timeline */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>4 · Time-of-day — clinical shifts as scale</span>
            <span className={s.m}>snaps to 06 / 14 / 22</span>
          </div>
          <div className={s.cardB}>
            <div className={s.lbl}>Schedule for</div>
            <div className={s.timeline}>
              <div className={s.scale}>
                <div className={s.track} />
                <div className={cx(s.shiftBand, s.day)} style={{ left: "25%", width: "33.33%" }} />
                <div
                  className={cx(s.shiftBand, s.eve)}
                  style={{ left: "58.33%", width: "33.33%" }}
                />
                <div className={cx(s.shiftBand, s.night)} style={{ left: "0%", width: "25%" }} />
                <div
                  className={cx(s.shiftBand, s.night)}
                  style={{ left: "91.66%", width: "8.33%" }}
                />

                <div className={cx(s.tick, s.major)} style={{ left: "0%" }} />
                <div className={s.tickLbl} style={{ left: "0%" }}>
                  00
                </div>
                <div className={s.tick} style={{ left: "25%" }} />
                <div className={cx(s.tick, s.major)} style={{ left: "25%" }} />
                <div className={s.tickLbl} style={{ left: "25%" }}>
                  06
                </div>
                <div className={s.tick} style={{ left: "50%" }} />
                <div className={s.tickLbl} style={{ left: "50%" }}>
                  12
                </div>
                <div className={cx(s.tick, s.major)} style={{ left: "58.33%" }} />
                <div className={s.tickLbl} style={{ left: "58.33%" }}>
                  14
                </div>
                <div className={s.tick} style={{ left: "75%" }} />
                <div className={s.tickLbl} style={{ left: "75%" }}>
                  18
                </div>
                <div className={cx(s.tick, s.major)} style={{ left: "91.66%" }} />
                <div className={s.tickLbl} style={{ left: "91.66%" }}>
                  22
                </div>
                <div className={cx(s.tick, s.major)} style={{ left: "100%" }} />

                <div className={s.marker} style={{ left: "35%" }}>
                  <div className={s.val}>08:30</div>
                  <div className={s.pin} />
                  <div className={s.head} />
                </div>
              </div>
              <div className={s.timelineLegend}>
                <span className={cx(s.l, s.day)}>Day shift · 06–14</span>
                <span className={cx(s.l, s.eve)}>Evening · 14–22</span>
                <span className={cx(s.l, s.night)}>Night · 22–06</span>
              </div>
            </div>
          </div>
          <div className={s.cardF}>
            Replaces a generic time picker with the only scale clinicians actually think in: shifts.
            Drag snaps to 5-minute steps; doubled snap at shift boundaries.
          </div>
        </div>

        {/* 5 · Body-site */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>5 · Body-site — anatomical prefix + region</span>
            <span className={s.m}>structured free-text</span>
          </div>
          <div className={s.cardB}>
            <div className={s.row2}>
              <div>
                <div className={s.lbl}>Site of injury</div>
                <div className={s.bsiteWrap}>
                  <div className={s.bsite}>
                    <span className={s.pre}>
                      Anterior <span className={s.chev} />
                    </span>
                    <input defaultValue="left distal forearm" />
                  </div>
                </div>
                <div className={s.hint}>
                  <span className={s.pip} />
                  Prefix · laterality · region — three controlled fields, one input
                </div>
              </div>
              <div>
                <div className={s.lbl}>Prefix menu (open)</div>
                <div className={s.bsite} style={{ opacity: 0.55 }}>
                  <span className={s.pre}>
                    Posterior <span className={s.chev} />
                  </span>
                  <input placeholder="region…" />
                </div>
                <div className={s.bsiteWrap} style={{ position: "relative", height: 0 }}>
                  <div
                    className={s.menu}
                    style={{ position: "relative", marginTop: 6, boxShadow: "none" }}
                  >
                    <div className={cx(s.item, s.on)}>
                      Anterior <span className={s.k}>A</span>
                    </div>
                    <div className={s.item}>
                      Posterior <span className={s.k}>P</span>
                    </div>
                    <div className={s.item}>
                      Lateral <span className={s.k}>L</span>
                    </div>
                    <div className={s.item}>
                      Medial <span className={s.k}>M</span>
                    </div>
                    <div className={s.item}>
                      Superior <span className={s.k}>S</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={s.cardF}>
            Anatomic adjectives have a closed list; region beyond is free-text. Result writes back
            as <code>anterior · left · distal forearm</code> — searchable, structured.
          </div>
        </div>

        {/* 6 · Allergy / danger */}
        <div className={s.card}>
          <div className={s.cardH}>
            <span className={s.t}>6 · Allergy field — required, watched</span>
            <span className={s.m}>copper hairline · escalates to code-red</span>
          </div>
          <div className={s.cardB}>
            <div className={s.lbl}>
              Known allergies <span className={s.req}>*</span>
            </div>
            <div className={s.danger} style={{ marginBottom: 12 }}>
              <span className={s.markerBar} />
              <input defaultValue="Penicillin · rash (2024)" />
              <span className={s.badge}>Logged · 1</span>
            </div>
            <div className={s.lbl}>
              Known allergies <span className={s.req}>*</span>
            </div>
            <div className={cx(s.danger, s.severe)}>
              <span className={s.markerBar} />
              <input placeholder="Required before issuing blood-thinner — type or 'NKDA'" />
              <span className={s.badge}>Required</span>
            </div>
            <div className={cx(s.hint, s.err)} style={{ marginTop: 6 }}>
              <span className={s.pip} />
              Code-Red pulse: blocking field — cannot proceed with current Rx
            </div>
          </div>
          <div className={s.cardF}>
            Always-visible left bar replaces a focus ring — the field carries its own warning even
            when not focused. Quiet copper for "watch" state, fast Code-Red pulse for blocking.
          </div>
        </div>
      </section>

      {/* Section ii — form layouts */}
      <section className={s.section}>
        <div className={s.secH}>
          <span className={s.num}>ii</span>
          <h2>Form layouts</h2>
          <span className={s.tag}>2 patterns</span>
        </div>
        <div className={s.secNote}>
          Two layouts cover most clinical surfaces. Use the <b>clinical form</b> for documents
          (registration, discharge, consent). Use the <b>vitals strip</b> when a row of fields reads
          as one continuous instrument.
        </div>

        {/* A · clinical form */}
        <div className={s.formClinical}>
          <div className={s.head}>
            <h3>
              Patient registration <em>— OPD</em>
            </h3>
            <div className={s.sub}>UH-2026-00342 · drafted 14:22 IST</div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>
              Full name <span className={s.req}>*</span>
            </div>
            <div className={cx(s.std, s.icon, s.h)}>
              <UserIcon className={s.ic} />
              <input defaultValue="Anika Verma" />
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>Date of birth · sex</div>
            <div className={s.row2}>
              <div className={cx(s.std, s.h)}>
                <input defaultValue="14 / 03 / 1986" />
                <span className={s.end}>DD/MM/YY</span>
              </div>
              <div className={s.segCtl}>
                <button
                  type="button"
                  className={sex === "female" ? s.on : undefined}
                  onClick={() => setSex("female")}
                >
                  Female
                </button>
                <button
                  type="button"
                  className={sex === "male" ? s.on : undefined}
                  onClick={() => setSex("male")}
                >
                  Male
                </button>
                <button
                  type="button"
                  className={sex === "other" ? s.on : undefined}
                  onClick={() => setSex("other")}
                >
                  Other
                </button>
              </div>
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>Contact</div>
            <div className={s.row2}>
              <div className={cx(s.std, s.h)}>
                <input defaultValue="+91 98 4322 1107" />
              </div>
              <div className={cx(s.std, s.h)}>
                <input defaultValue="anika.v@protonmail.in" />
              </div>
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>Insurance / TPA</div>
            <div>
              <div className={cx(s.std, s.h)}>
                <input className={s.warn} defaultValue="ICICI-LOMBARD-449288" />
              </div>
              <div className={cx(s.hint, s.cop)} style={{ marginTop: 8 }}>
                <span className={s.pip} />
                TPA changed since last visit — verify policy validity
              </div>
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>
              Allergies <span className={s.req}>*</span>
            </div>
            <div>
              <div className={s.danger}>
                <span className={s.markerBar} />
                <input defaultValue="Penicillin · rash (2024)" />
                <span className={s.badge}>Logged · 1</span>
              </div>
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>Reason for visit</div>
            <div className={cx(s.std, s.h)}>
              <textarea defaultValue="Sore throat with fever, 4 days. Otherwise well. No travel." />
            </div>
          </div>

          <div className={s.frow}>
            <div className={s.lhs}>Consent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className={s.chk}>
                <input
                  type="checkbox"
                  checked={consents.treatment}
                  onChange={(e) =>
                    setConsents((prev) => ({ ...prev, treatment: e.target.checked }))
                  }
                />
                <span className={s.box} />
                Consent to treatment and storage of medical record
              </label>
              <label className={s.chk}>
                <input
                  type="checkbox"
                  checked={consents.research}
                  onChange={(e) => setConsents((prev) => ({ ...prev, research: e.target.checked }))}
                />
                <span className={s.box} />
                Allow research use of de-identified data (optional)
              </label>
            </div>
          </div>

          <div className={s.foot}>
            <div className={s.meta}>Auto-saved · 14:24 IST</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className={cx(s.btn, s.ghost)}>
                Save draft
              </button>
              <button type="button" className={cx(s.btn, s.prim)}>
                Register patient
              </button>
            </div>
          </div>
        </div>

        {/* B · vitals strip */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div style={{ font: "600 13px var(--font-sans)" }}>Vitals on admission</div>
            <div
              style={{
                font: "500 10px var(--font-mono)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Triage nurse · 14:24 IST
            </div>
          </div>
          <div className={s.vitalsStrip}>
            <div className={cx(s.vc, s.entered)}>
              <div className={s.k}>
                BP <span className={s.ref}>90/60–140/90</span>
              </div>
              <div className={s.field}>
                <span className={s.v}>128/82</span>
                <span className={s.u}>mmHg</span>
              </div>
            </div>
            <div className={cx(s.vc, s.warn)}>
              <div className={s.k}>
                HR <span className={s.ref}>60–100</span>
              </div>
              <div className={s.field}>
                <span className={s.v}>112</span>
                <span className={s.u}>bpm</span>
              </div>
              <div className={s.pulse} />
            </div>
            <div className={cx(s.vc, s.entered)}>
              <div className={s.k}>
                SpO₂ <span className={s.ref}>95–100</span>
              </div>
              <div className={s.field}>
                <span className={s.v}>98</span>
                <span className={s.u}>%</span>
              </div>
            </div>
            <div className={cx(s.vc, s.entered)}>
              <div className={s.k}>
                Temp <span className={s.ref}>36.5–37.5</span>
              </div>
              <div className={s.field}>
                <span className={s.v}>38.2</span>
                <span className={s.u}>°C</span>
              </div>
            </div>
            <div className={s.vc}>
              <div className={s.k}>
                RR <span className={s.ref}>12–20</span>
              </div>
              <div className={s.field}>
                <span className={s.v} style={{ color: "var(--sub)", fontStyle: "italic" }}>
                  —
                </span>
                <span className={s.u}>br/min</span>
              </div>
            </div>
          </div>
          <div className={s.hint} style={{ marginTop: 8 }}>
            <span className={s.pip} />
            Hairline borders unify the row. Copper pulse marks the field that crossed reference.
            Empty cell stays italic-em-dash, not <code>0</code>.
          </div>
        </div>
      </section>

      {/* Section iii — standard */}
      <section className={s.section}>
        <div className={s.secH}>
          <span className={s.num}>iii</span>
          <h2>Standard inputs — utility set</h2>
          <span className={s.tag}>refreshed</span>
        </div>
        <div className={s.secNote}>
          For everything that doesn't need the specialised treatment. Same tokens, no decoration.
        </div>

        <div className={s.card}>
          <div className={s.cardB}>
            <div className={s.row3}>
              <div>
                <div className={s.lbl}>Username</div>
                <div className={cx(s.std, s.icon)}>
                  <UserIcon className={s.ic} />
                  <input defaultValue="dr.kapoor" />
                </div>
              </div>
              <div>
                <div className={s.lbl}>Password</div>
                <div className={cx(s.std, s.icon)}>
                  <LockIcon className={s.ic} />
                  <input type="password" defaultValue="abcdefghij" />
                </div>
              </div>
              <div>
                <div className={s.lbl}>Search</div>
                <div className={cx(s.std, s.icon)}>
                  <SearchIcon className={s.ic} />
                  <input placeholder="Search patients, drugs, orders…" />
                </div>
              </div>
            </div>

            <div className={s.row3} style={{ marginTop: 14 }}>
              <div>
                <div className={s.lbl}>Department</div>
                <div className={s.segCtl}>
                  {(["all", "opd", "ipd", "er"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={dept === k ? s.on : undefined}
                      onClick={() => setDept(k)}
                    >
                      {k === "all" ? "All" : k.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className={s.lbl}>Active</div>
                <label className={s.switch}>
                  <input
                    type="checkbox"
                    checked={onCall}
                    onChange={(e) => setOnCall(e.target.checked)}
                  />
                  <span className={s.tr} />
                  <span>Receive on-call alerts</span>
                </label>
              </div>
              <div>
                <div className={s.lbl}>Mode</div>
                <div style={{ display: "flex", gap: 18, paddingTop: 8 }}>
                  <label className={s.rad}>
                    <input
                      type="radio"
                      name="m"
                      checked={mode === "inpatient"}
                      onChange={() => setMode("inpatient")}
                    />
                    <span className={s.dot} />
                    Inpatient
                  </label>
                  <label className={s.rad}>
                    <input
                      type="radio"
                      name="m"
                      checked={mode === "outpatient"}
                      onChange={() => setMode("outpatient")}
                    />
                    <span className={s.dot} />
                    Outpatient
                  </label>
                </div>
              </div>
            </div>

            <div className={s.row2} style={{ marginTop: 14 }}>
              <div>
                <div className={s.lbl}>Notes</div>
                <div className={s.std}>
                  <textarea defaultValue="Patient reports onset 4 days ago, fever responsive to paracetamol." />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className={s.lbl}>Confirmations</div>
                <label className={s.chk}>
                  <input
                    type="checkbox"
                    checked={confirms.signed}
                    onChange={(e) => setConfirms((prev) => ({ ...prev, signed: e.target.checked }))}
                  />
                  <span className={s.box} />
                  Order signed by attending
                </label>
                <label className={s.chk}>
                  <input
                    type="checkbox"
                    checked={confirms.readback}
                    onChange={(e) =>
                      setConfirms((prev) => ({ ...prev, readback: e.target.checked }))
                    }
                  />
                  <span className={s.box} />
                  Verbal read-back complete
                </label>
                <label className={s.chk}>
                  <input
                    type="checkbox"
                    checked={confirms.briefed}
                    onChange={(e) =>
                      setConfirms((prev) => ({ ...prev, briefed: e.target.checked }))
                    }
                  />
                  <span className={s.box} />
                  Patient briefed on side-effects
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
