# Platform Accessibility Rules — the Power of Ten

**LAW for every native surface**: iOS and Android handhelds and tablets, Android
TV, webOS TV, tvOS, and kiosk builds. The web's rules live in
[WCAG-2.2-RULES.md](./WCAG-2.2-RULES.md); these are what the *platforms*
additionally require, because a screen reader on a TV remote is not a screen
reader on a phone, and shipping the same markup to both fails one of them.

Forms and keyboards have their own ten:
[MOBILE-FORM-KEYBOARD-RULES.md](./MOBILE-FORM-KEYBOARD-RULES.md).

**Why this is not optional here.** A hospital employs the people it serves.
Ward clerks, nurses and doctors include colleagues with low vision, colour
blindness, motor impairment and hearing loss, and a waiting-room board is read
by patients who are elderly, anxious, or holding a child. A token board nobody
can read is a queue nobody can join.

Each rule states the requirement, then what it means **item-wise per platform**.

---

## 1. Every element has a name that says what it does

Not what it looks like, not an id, not "button".

- **iOS**: `accessibilityLabel` on every interactive element; VoiceOver reads it.
  Never leave an icon-only control unlabelled.
- **Android**: `contentDescription` on every non-text element; `null` for purely
  decorative ones so TalkBack skips them rather than reading noise. Describe the
  *purpose*, and do not append the role — Android says say "Submit", not "Submit
  button", because TalkBack adds the role itself.
- **TV**: Android's TalkBack review fails an app outright for labels like
  `unlabeled` or `item 08328492qw`. Row headings must be announced, not just
  their contents.
- **React Native (our surfaces)**: `accessibilityLabel` + `accessibilityRole`.
  The `@medbrains/ui-mobile` seam requires it; a raw control does not, which is
  one reason the seam is mandatory.

## 2. Labels must be unique within a list

"Open" repeated nineteen times down a ward list tells a screen-reader user
nothing about which bed they are on. Include the distinguishing fact: "Open bed
7, Asha Kumar".

Android calls this out explicitly for `LazyColumn`; it applies to every
`FlatList` we ship.

## 3. State is announced, not shown

A toggle, a selection, a busy state and an error are all *state*. Colour and
position convey none of it to a screen reader.

- Use `accessibilityState` (`selected`, `disabled`, `checked`, `busy`).
- Announce the change, not only the new appearance: "Subtitles, on".
- **TV**: the TalkBack guide fails apps whose setting changes are silent —
  a confirmation must be spoken with the resulting state.
- Never colour-alone (WCAG SC 1.4.1). A red outline needs error text beside it.

## 4. Targets meet the platform floor

- **iOS**: 44×44 pt. Apple's long-standing floor; below it tap error rates climb
  sharply for users with motor impairment.
- **Android**: 48×48 dp.
- **WCAG 2.2 SC 2.5.8**: 24 CSS px absolute minimum.
- **TV**: focusable rows sized for a 10-foot viewing distance — `tapTarget()`
  returns 64 for TV surfaces.

Take the **largest** floor that applies to the surface; `tapTarget()` in
`@medbrains/ui-mobile` encodes this (phone 44, tablet 48, TV 64).

## 5. Focus is visible, ordered, and never trapped

- **Handheld**: traversal order follows meaning (SC 2.4.3), and the focused
  element is never hidden behind a keyboard or sticky bar (SC 2.4.11).
- **TV is where this is won or lost.** Every interactive element must be
  reachable by D-pad; focus must not jump, loop, or strand. Set an explicit
  initial focus (`hasTVPreferredFocus`) and use `TVFocusGuideView` for
  directional intent — see
  [DEVICE-SURFACE-DESIGN-RULES.md](./DEVICE-SURFACE-DESIGN-RULES.md) rule 3.
- The focus indicator on TV must be **obvious** across a room, not a 1px ring.
- Back must return where the user came from.

## 6. Respect the user's text size

- **iOS**: support Dynamic Type; never hard-code font sizes that ignore it.
- **Android**: honour `fontScale`; use `wrap_content` and let layouts reflow.
  Test at 1.2× and above (`adb shell settings put system font_scale 1.2f`).
- **Android TV**: the same scaling applies; verify components still fit
  on-screen when text grows, and avoid fixed heights that clip.
- A layout that breaks at large text is a defect, not a user error.

## 7. Contrast is measured, not eyeballed

- Body text ≥ **4.5:1**; large text (≥18sp, or ≥14sp bold) ≥ **3:1**.
- Non-text UI (focus rings, input borders, icons carrying meaning) ≥ **3:1**.
- **TV**: light-on-dark, and remember viewers use High Contrast, Grayscale and
  Colour Inversion modes — webOS exposes all three. A design that only works in
  full colour fails those users.
- Colours come from tokens, never raw hex (see
  [CARBON-COLOR-RULES.md](./CARBON-COLOR-RULES.md) and
  `make check-mobile-tokens`).

## 8. Nothing important is only audible, and nothing plays itself

- Captions and audio description for any media.
- **TV**: content must not auto-play. Android's review fails apps that start
  playback without user action, or that offer no immediate way to stop it —
  it disorients screen-reader users who cannot see what started.
- **webOS**: do not fight the platform's Audio Guidance; if the app speaks over
  it, the user loses both.
- Honour `prefers-reduced-motion` / reduce-motion settings.

## 9. Text entry must be possible without sight

- **Handheld**: real labels, wired errors, autofill allowed, paste never blocked
  (SC 3.3.8) — see the form rules.
- **TV**: an on-screen keyboard must be navigable **character by character**,
  each character announced. Login codes shown on screen must be readable the
  same way. This is where most TV apps fail review, and it is the one flow every
  user must complete before seeing anything at all.

## 10. Prove it the way the platform tests it — the no-look test

Automated checks are necessary and insufficient. Android's TV review method is
the standard to adopt everywhere:

> Complete the journey **without looking at the screen**.

If sign-in, finding the patient, or reading the token cannot be done by audio
alone, the surface fails — regardless of what a linter says.

- **iOS**: VoiceOver + Dynamic Type at maximum + Reduce Motion.
- **Android**: TalkBack + Accessibility Scanner + `fontScale` 1.2/1.5, plus Lint.
- **TV**: TalkBack on device with the remote only, screen off or eyes closed.
- Record the result in the surface's journey test, which must assert on ids and
  labels rather than on how anything looks.

---

## Enforcement

- `make check-mobile-forms` — the form and keyboard rules.
- `make check-mobile-tokens` — no raw hex; colours from tokens.
- `make check-ui-seam` — controls come from the seam, which carries the label
  and target-size requirements.
- Detox journeys match on `testID` and assert `accessibilityState`, never on
  copy or colour.

## Sources

Android [accessibility for apps](https://developer.android.com/guide/topics/ui/accessibility/apps)
(48dp targets, 4.5:1 / 3:1 contrast, content descriptions, unique labels in
lists, decorative elements hidden, Accessibility Scanner + Lint).
Android TV [accessibility](https://developer.android.com/training/tv/accessibility)
and [TalkBack evaluation](https://developer.android.com/training/tv/accessibility/talkback)
(D-pad reachability, no focus jumping, announced row headings and state, no
auto-play, character-by-character on-screen keyboard, the no-look test; WHO
figure of 2.2 billion people with vision impairment).
Apple [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)
(44×44pt targets, VoiceOver labels on every element, Dynamic Type, 4.5:1
contrast).
LG [webOS TV accessibility features](https://www.lg.com/uk/support/product-help/CT00008334-1437131032496)
(Audio Guidance, High Contrast, Grayscale, Colour Inversion, Audio Description).
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) via [WCAG-2.2-RULES.md](./WCAG-2.2-RULES.md).
