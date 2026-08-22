/**
 * Keyboard traversal for forms — an accessibility requirement, not a nicety.
 *
 * WCAG 2.2 SC 2.1.1 (Keyboard) and SC 2.4.3 (Focus Order): every control must
 * be operable from the keyboard, in an order that follows meaning. On a
 * handheld the software keyboard IS the keyboard, and its return key is the
 * only "move to the next field" affordance a one-handed user has. A form whose
 * return key does nothing forces a reach-and-tap for every field, which is the
 * difference between a clerk registering forty walk-ins comfortably and doing
 * it with a thumb ache.
 *
 * ## The numeric-keyboard trap
 *
 * `phone-pad`, `number-pad` and `decimal-pad` have NO return key. `returnKeyType`
 * is ignored and `onSubmitEditing` never fires, so a numeric field cannot hand
 * focus on and cannot submit. This is not a theory: a registration journey in
 * this repo dismissed its keyboard with `tapReturnKey()` on a `phone-pad` field
 * and silently did nothing, leaving the submit button under the keyboard.
 *
 * A numeric field therefore needs an explicit Done/Next affordance above the
 * keyboard. `needsDoneAccessory` says which fields those are; never rely on the
 * return key for them, and never make one the last field in a chain.
 */

/**
 * ## The multi-line rule
 *
 * A multi-line field's return key inserts a newline -- Android documents the
 * default for `textMultiLine` as a carriage return rather than an action, and
 * says such a field does not auto-close the keyboard at all. A clinician
 * writing an examination needs those newlines, so chaining prose fields by the
 * return key would steal the one key they need. Multi-line fields are
 * traversed by an accessory bar instead, never by the return key.
 */

/** Keyboards that render no return key, so cannot advance or submit. */
const RETURN_KEYLESS = new Set(["phone-pad", "number-pad", "decimal-pad", "numeric"]);

export type ChainKeyboard = string | undefined;

/**
 * True when this keyboard has no return key and the field needs an accessory
 * bar to be traversable at all.
 */
export function needsDoneAccessory(keyboardType: ChainKeyboard): boolean {
  return keyboardType !== undefined && RETURN_KEYLESS.has(keyboardType);
}

/** The field the return key should move to, or null at the end of the chain. */
export function nextField(names: readonly string[], current: string): string | null {
  const index = names.indexOf(current);
  if (index < 0 || index === names.length - 1) return null;
  return names[index + 1] ?? null;
}

/**
 * `next` while there is somewhere to go, `done` on the last field.
 *
 * `done` is what tells the user the form ends here, and pairs with submitting
 * rather than blurring into nothing.
 */
export function returnKeyFor(names: readonly string[], current: string): "next" | "done" {
  return nextField(names, current) === null ? "done" : "next";
}

/**
 * Whether the keyboard should stay up after this field.
 *
 * It should, right up until the last field: dismissing between fields makes
 * the layout jump on every hop, and on a keyboard-avoiding form that means the
 * next field moves out from under the thumb about to reach it.
 */
export function shouldKeepKeyboard(names: readonly string[], current: string): boolean {
  return nextField(names, current) !== null;
}

/**
 * Whether this field can be traversed with the return key at all.
 *
 * Two kinds cannot, for opposite reasons: a numeric keyboard has no return key
 * to press, and a multi-line field needs its return key for newlines. Both need
 * a visible Next/Done control above the keyboard instead. Deciding this per
 * field, rather than assuming every input behaves like a single-line text box,
 * is what keeps the traversal honest on a real form.
 */
export function canChainByReturnKey(field: {
  keyboardType?: ChainKeyboard;
  multiline?: boolean;
}): boolean {
  return !field.multiline && !needsDoneAccessory(field.keyboardType);
}
