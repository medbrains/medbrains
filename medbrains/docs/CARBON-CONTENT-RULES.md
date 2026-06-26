# Content, Voice & Tone Rules (MedBrains)

Actionable extraction of IBM's voice/tone + accessible-content guidance, adapted
for a clinical system. UI words are part of patient safety — they must be clear,
accurate, and humane.

## Voice (always)

- **Clear, helpful, human.** Plain language; short sentences; active voice
  ("Save changes", not "Changes may be saved"). No jargon in chrome.
- **Sentence case** for UI text (buttons, labels, headings, menus) — not Title
  Case, not ALL CAPS (except short mono eyebrows).
- **Concise** — say it in the fewest clear words; cut filler ("please", "in order
  to", "simply").
- **Address the user as "you"**; refer to the system as "MedBrains" or implicitly.

## Tone (adapts to context)

- **Calm & reassuring** in clinical flows; never alarming for routine actions.
- **Direct & urgent** for genuine alerts (critical values, emergency codes) —
  unambiguous, action-first.
- **Neutral & factual** for data/records; **encouraging** for empty states/onboarding.
- Never blame the user; never be cute about errors or safety.

## Errors & system messages

- **What happened + how to fix**, in plain words. No stack traces, no codes-only,
  no "An error occurred." Tie field errors to the field (WCAG 3.3.1/3.3.3).
- Confirm destructive/clinical actions in clear terms (what will change, to whom).
- Success/status messages are brief and specific ("Prescription signed").

## Clinical accuracy

- **Precise medical terminology where it matters** (drug names, doses, units,
  diagnoses) — accuracy beats simplification for clinical data. Keep *chrome*
  plain, keep *clinical content* exact.
- Always show **units, reference ranges, and timestamps** with clinical values.
- Use standard codings in records (INN/ATC, ICD, LOINC) per the regulatory norms.

## Accessible & inclusive content (WCAG 2.2)

- **Meaningful link/button text** — never "click here"/"read more" alone (the text
  must make sense out of context, SC 2.4.4/2.4.9).
- **Expand abbreviations** on first use / via `<abbr>` (the `Abbr` seam component);
  don't assume the reader knows an acronym.
- **Plain-language default** (SC 3.1.5 reading level) for non-clinical UI; define
  terms.
- **Inclusive, bias-free, person-first** language (e.g. "person with diabetes").
  Respect gender, ability, age; avoid stigmatizing terms.
- **Localizable** — never hardcode strings; write for translation (avoid idioms,
  concatenation, baked-in plurals); support RTL.
- Don't rely on colour/icon words alone ("the red one") — name the thing.

## Applied

- All UI strings via i18n keys (`react-i18next`), sentence case, reviewed for
  clarity. Eyebrows = short mono uppercase. Toasts use `role="status"`.
