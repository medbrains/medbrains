/**
 * Reading and writing variable values in a single-line text field.
 *
 * A variable keeps the type it was stored with, because a batch size that
 * comes back as `"500"` fails differently, and later, than one that comes back
 * as `500`. That means a text box has to decide which of those the person
 * typing meant — and has to be predictable about it, since the answer is
 * invisible until something breaks.
 */
import type { JsonValue } from '../types'

/**
 * What the field shows for a stored value.
 *
 * A string shows as itself with no quotes: typing `https://x` and seeing
 * `"https://x"` come back reads as an error, and quoting is not something
 * anybody wants to think about while configuring a hostname.
 */
export function showValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * What a typed value is stored as.
 *
 * Numbers, booleans and `null` are recognised, because those are the ones a
 * node actually treats differently. Anything else is a string — including
 * things that merely look like JSON, since a value with a brace in it is far
 * more likely to be a template than an object somebody meant to nest.
 */
export function parseValue(raw: string): JsonValue {
  const text = raw.trim()

  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null

  // `Number('')` is 0, and an empty box means an empty string.
  if (text !== '' && Number.isFinite(Number(text))) return Number(text)

  return raw
}

/** How long a name may be before the server refuses it. */
const MAX_KEY_CHARS = 128

/**
 * Why a name cannot be used, or `null` if it can.
 *
 * Checked here as well as on the server because the reason matters: a name
 * with a hyphen is settable and permanently unreadable, since
 * `{{ vars.my-var }}` parses as a subtraction. Better to say so while somebody
 * is typing it than after they have wired it into four nodes.
 */
export function validateKey(key: string): string | null {
  if (key === '') return 'A name is required'
  if (key.length > MAX_KEY_CHARS) return `At most ${MAX_KEY_CHARS} characters`
  if (!/^[A-Za-z_]/.test(key)) return 'Start with a letter or underscore'
  if (!/^[A-Za-z0-9_]+$/.test(key)) {
    return 'Letters, numbers and underscores only — otherwise {{ vars.name }} cannot read it'
  }
  return null
}
