# Stopping patient data leaving the screen

What is possible, what is not, and what we actually do.

---

## The part people expect and cannot have

**A web page cannot prevent a screenshot.** There is no browser API for it. The
operating system's screenshot key is not something JavaScript is told about,
let alone able to intercept, and if it were, a phone pointed at the monitor
would defeat it anyway.

**A web page cannot prevent copying.** `user-select: none` and an `oncopy`
handler stop a drag-select. They do not stop devtools, "view source", the print
dialog, the accessibility tree, or a script calling the same API the page
calls with the same session cookie.

This matters more than it sounds. A hospital told its records are protected
staffs and trains accordingly: fewer questions about who has a workstation
open, less care about who is standing behind a screen. **Security theatre here
is worse than nothing**, because it substitutes for the controls that work.

If a vendor demonstrates screenshot blocking in a browser, they are blocking
the *print-screen key in one browser on one operating system* and nothing else.

## What we do instead

Three controls that hold up, in `apps/web/src/components/PhiGuard`.

### 1. Traceability — the one that works

A tiled watermark carrying the viewer's name and the current time, drawn over
patient data. A leaked screenshot then identifies who took it.

This is the only control on this page that survives a determined person, and
it is the only one that changes behaviour: deterrence by attribution rather
than by obstacle. It also survives the likeliest capture in a hospital, which
is not a screenshot but a printout — hence `print-color-adjust: exact` and a
higher opacity under `@media print`.

The label is recomputed on render, not stamped at mount. A ward workstation
nobody logged out of would otherwise carry a timestamp hours old.

### 2. Friction

Selection is disabled over patient data, so copying into a chat window takes
deliberate effort rather than a reflex. Inputs stay selectable — blocking
selection inside a field breaks correction, and a clinician who cannot fix a
typo will work around the system rather than with it.

### 3. Evidence

Copy events are reported, not blocked. Two reasons:

* blocking teaches people to find a way around, and they do;
* a clinician copying a UHID into a lab form is doing their job. Break that and
  they retype it — putting transcription errors into patient *identity*, which
  is the one field where they must never be.

A record is worth nothing until an investigation needs it, and then it is
decisive.

## Mobile: the only place real prevention exists

Android's `FLAG_SECURE` genuinely blocks screenshots and blanks the app in the
task switcher. It is a window flag, enforced by the OS, and it works.

iOS has no equivalent. It can *detect* a screenshot after the fact
(`userDidTakeScreenshotNotification`) and blur the window when the app
backgrounds, but it cannot prevent the capture.

**Neither is implemented, and one of them currently cannot be.** As of
2026-08-12:

| surface | `android/` | `ios/` |
|---|---|---|
| `mobile-staff` | ✗ | ✓ |
| `mobile-camp` | ✗ | ✓ |
| `mobile-patient` | ✗ | ✗ |
| `mobile-vendor` | ✗ | ✗ |
| `mobile` | ✗ | ✗ |
| `tv` | ✓ | ✗ |

The apps are real — React Native 0.81.5, 87 TypeScript files in
`mobile-staff` — but the native projects have not been generated. `FLAG_SECURE`
is three lines in `MainActivity`, and there is no `MainActivity` to put them
in. Generating Android projects for five apps in order to add one window flag
is the wrong order of work; the flag goes in when the projects do.

When that happens:

```kotlin
// MainActivity.onCreate — before super, before the view exists.
window.setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE,
)
```

Blanket rather than per-screen. A flag toggled per screen leaves a window
during navigation where it is off, and that window is exactly when a task
switcher snapshot is taken.

## What actually protects patient data

None of the above is the main control. The ones that carry the weight:

| | |
|---|---|
| **access control** | 13 of 91 patient routes check it — see `CERTIFICATION-READINESS.md` §0 |
| **audit** | who read which record, and when |
| **break-glass** | an emergency override that is recorded rather than absent |
| **session hygiene** | idle timeout on shared ward workstations |
| **field-level masking** | `FieldAccessLevel::Mask`, already built |

A watermark tells you who leaked a record. Access control stops them reading
it in the first place. If effort has to go one place, it goes there.
