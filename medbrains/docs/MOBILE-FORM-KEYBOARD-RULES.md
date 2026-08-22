# Mobile Form & Keyboard Rules — the Power of Ten

**These are LAW for every form on every touch surface** — all `Mobile-*`, all
`TV-*`, `Desktop-Kiosk`, and any handheld or tablet build. They are not
consultation-screen rules or registration-screen rules; a rule that applies to
one form applies to all of them, or it is not a rule.

Ten, in the style of the constrained-device
[Power of Ten](./DEVICE-CONSTRAINED-RULES.md), because a checklist people can
hold in their head is one they actually run.

## Why these are patient-safety rules, not polish

A front-office clerk registers forty walk-ins on a Monday morning. A doctor
writes a consultation between two patients with a queue outside the door. Every
avoidable tap is repeated dozens of times a shift, and a form that fights the
person filling it in is a form they fill in wrongly — wrong field, wrong
patient, abandoned halfway. Input friction on a clinical handheld converts
directly into bad records.

Half of these are also **WCAG 2.2 AA obligations** (SC 2.1.1 Keyboard, 2.4.3
Focus Order, 2.4.11 Focus Not Obscured, 2.5.8 Target Size, 3.3.1 Error
Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion, 3.3.7
Redundant Entry), which the project treats as a patient-safety requirement for
specially-abled users. See [WCAG-2.2-RULES.md](./WCAG-2.2-RULES.md).

---

## 1. Every input declares its keyboard

A field's keyboard must match its content: phone → `phone-pad`, number →
`number-pad`, email → `email-address`, prose → `default` with
`autoCapitalize="sentences"`.

Apple: the keyboard "should be appropriate for the type of content in the
field." Android: **always** declare `inputType`, or the system cannot choose
one for you.

Never make a clerk hunt for the digit layer to type a phone number.

## 2. A visible label, always — the placeholder is not one

Every field has a persistent visible label. A required field is marked in text,
not by colour alone.

**This overrides Apple's HIG on purpose.** Apple permits "Don't use a separate
label to describe a text field when placeholder text is sufficient." A
placeholder disappears the moment the user types, which fails WCAG 2.2 SC 3.3.2
and strands anyone interrupted mid-form — the normal condition at a hospital
desk. Where Apple and WCAG disagree here, **WCAG wins**; the project's
accessibility rule is not optional. Placeholders are for *examples*
(`YYYY-MM-DD`), never for the name of the field.

## 3. The return key advances — where the return key exists

Single-line text fields chain: `returnKeyType="next"` down the form,
`"done"` on the last one, focus moved in `onSubmitEditing`. Focus order follows
meaning (SC 2.4.3).

Two kinds of field **cannot** be chained this way, for opposite reasons, and
assuming they can is the most common way this rule is got wrong:

- **Numeric keyboards have no return key.** `phone-pad`, `number-pad`,
  `decimal-pad` ignore `returnKeyType` and never fire `onSubmitEditing`. This
  is not theoretical: a registration journey in this repo dismissed its
  keyboard with `tapReturnKey()` on a `phone-pad` and silently did nothing,
  leaving the submit button under the keyboard and the test red for eight runs.
- **Multi-line fields need their return key for newlines.** Android documents
  the default for `textMultiLine` as a carriage return rather than an action,
  and notes such a field never auto-closes the keyboard. A clinician writing an
  examination must be able to press return for a new line.

Use `canChainByReturnKey()` from `@medbrains/ui-mobile` to decide per field.
Never hand-wave it per screen.

## 4. Anything the return key cannot reach gets a navigator bar

Where rule 3 says a field cannot chain, an accessory bar above the keyboard
must provide **Back / Next / Done** and show the position (`2 of 4`).

Without it those fields are a dead end: dismiss the keyboard, hunt, tap. Use
`<FieldNavigator>` from `@medbrains/ui-mobile`. Position is part of the
requirement — a form traversed blind is a form you lose your place in.

## 5. The keyboard never covers the field or the submit

Forms scroll inside `<FormScrollView>` (keyboard-avoiding, `padding` on iOS)
with enough bottom inset that the last control clears the home indicator.
Tapping outside dismisses (`keyboardShouldPersistTaps="handled"`), and dragging
dismisses (`keyboardDismissMode="on-drag"`).

WCAG 2.2 SC 2.4.11 (Focus Not Obscured) makes this a conformance failure, not a
nuisance. It is also the single most-cited mobile UX defect in the field.

## 6. Validate on submit, correct on change, and say what to do

Do not shout at someone mid-typing. Show a field's error **after** they leave it
or after a submit attempt; once an error is showing, clear it as they fix it.

Every error names the field, the problem, and the fix (SC 3.3.1, 3.3.3).
"Invalid input" is not an error message. "Phone must be 10 digits" is.

**Never disable the submit button on validity.** A greyed-out button explains
nothing and cannot be interrogated by a screen reader; worse, validity usually
resolves a tick after the last keystroke, so a fast hand presses a dead control
and gets silence. Let the press run validation and mark the offending fields.
Disable only while a write is genuinely in flight — that is what stops a double
submit.

## 7. Targets are at least 44×44 pt (48 dp on Android)

Apple 44pt, Material 48dp, WCAG 2.2 SC 2.5.8 24px floor — take the largest that
applies to the surface. `tapTarget()` in `@medbrains/ui-mobile` returns the
right minimum per surface (phone 44, tablet 48, TV 64).

Primary actions belong in the bottom two-thirds of the screen, inside thumb
reach.

## 8. Every action answers immediately

A press produces a visible response within 100ms and a busy state for anything
slower: `loading` on the button, a skeleton or `EcgLoader` for a fetch, a
snackbar for the outcome.

Never let a save look like nothing happened — silence reads as a broken app and
earns a second press on a non-idempotent write.

## 9. Repetition is the job — design for the second one

Where a role does the same task repeatedly, the form must offer **Save and add
next**: commit, confirm what was created, and return a form ready for the next
one.

What carries over is the **desk, not the person**. Context the operator set
(department, source, referral, camp) is kept; identity and anything clinical is
cleared, because an inherited MLC flag or diagnosis is a wrong record, not a
saved keystroke. This is also WCAG 2.2 SC 3.3.7 (Redundant Entry): do not ask
again for what the session already knows.

## 10. Never lose what was typed

An interruption — a call, a lock screen, a navigation — must not empty the
form. Preserve entry across backgrounding, warn before discarding a dirty form,
and on a failed write keep the values on screen with the error, never clear
them.

On a ward with intermittent wifi this is the difference between a retry and a
re-type.

---

## Enforcement

- `make check-mobile-forms` — fails on a raw `TextInput`/`TextField` outside the
  `@medbrains/ui-mobile` seam, a field with no label, a numeric or multi-line
  field wired to `onSubmitEditing`, and a submit disabled on `isValid`.
- Unit tests: `packages/ui-mobile/src/field-chain.test.ts` fixes the traversal
  rules; each form's own test fixes what its "add next" carries over.
- Every form needs a journey test that **presses the submit and proves the
  effect**, never that the button was reachable. See
  `apps/mobile-staff/e2e/helpers.ts` for why the weaker assertion is worthless.

## Sources

Apple [Human Interface Guidelines — Text Fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)
(keyboard appropriate to content; secure fields for sensitive data; clear
button; use a text view, not a text field, for multi-line).
Android [Handle input method visibility / IME options](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/style)
(always declare `inputType`; `actionNext` for sequences, `actionDone` to finish;
multi-line defaults to a carriage return and does not auto-close).
[Material Design](https://m3.material.io/components/text-fields/guidelines)
(labels, helper and error text, 48dp targets).
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) via [WCAG-2.2-RULES.md](./WCAG-2.2-RULES.md).
[UXCam — mobile UX](https://uxcam.com/blog/mobile-ux/) (44pt/48dp targets,
keyboard specificity, specific error copy, offline state, resumability).
