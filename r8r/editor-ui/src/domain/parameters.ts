/** Rules for rendering a node's parameter panel from its declared schema. */

import type { JsonValue, NodeProperty } from '../types'

/**
 * A field declares `displayOptions` to stay hidden until it is relevant — the
 * HTTP node's JSON body only appears once Body Type is JSON, and an
 * integration's fields only appear for the resource and operation they belong
 * to. Every `show` condition must hold; any `hide` match wins.
 *
 * An unset parameter never satisfies a `show` rule, so a field gated on a
 * choice the user has not made yet stays hidden.
 */
export function isVisible(
  property: NodeProperty,
  parameters: Readonly<Record<string, JsonValue>>,
): boolean {
  const rules = property.displayOptions
  if (!rules) return true

  const matches = (field: string, values: readonly JsonValue[]) =>
    field in parameters && values.some((value) => sameValue(value, parameters[field]))

  if (Object.entries(rules.hide ?? {}).some(([field, values]) => matches(field, values))) {
    return false
  }
  return Object.entries(rules.show ?? {}).every(([field, values]) => matches(field, values))
}

/** Conditions compare by value, so the string "1" never matches the number 1. */
function sameValue(a: JsonValue, b: JsonValue | undefined): boolean {
  if (b === undefined) return false
  if (typeof a !== 'object' || a === null) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The value to render for a property, falling back to its declared default. */
export function valueOf(
  property: NodeProperty,
  parameters: Readonly<Record<string, JsonValue>>,
): JsonValue {
  const current = parameters[property.name]
  return current === undefined ? property.default : current
}

/**
 * Bring a node's parameters into a state its own schema agrees with.
 *
 * Integration nodes reuse the name `operation` once per resource, so the
 * parameters only make sense read in order: `resource` decides which
 * `operation` property is live, and that in turn decides which fields are.
 * Walking the list top-down and fixing each visible property as we go is what
 * makes switching Resource reset Operation to something that resource
 * actually supports — rather than leaving a value the server would reject.
 *
 * Returns the same object when nothing needed changing, so callers can skip a
 * pointless state update.
 */
export function normalizeParameters(
  properties: readonly NodeProperty[],
  parameters: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const next: Record<string, JsonValue> = { ...parameters }
  let changed = false

  for (const property of properties) {
    if (!isVisible(property, next)) continue

    const current = next[property.name]
    if (current === undefined) {
      next[property.name] = property.default
      changed = true
      continue
    }

    // A dropdown holding a value it no longer offers renders blank and fails
    // on execution; snap it back to this property's own default.
    if (property.type === 'options' && property.options && property.options.length > 0) {
      const offered = property.options.some((option) => String(option.value) === String(current))
      if (!offered) {
        next[property.name] = property.default
        changed = true
      }
    }
  }

  return changed ? next : (parameters as Record<string, JsonValue>)
}

/** Render any JSON value in a single-line text input without losing type. */
export function asText(value: JsonValue): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

/** Key/value editors work on entry lists; the model stores an object. */
export function toEntries(value: JsonValue): [string, JsonValue][] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
}

export function fromEntries(entries: readonly [string, JsonValue][]): JsonValue {
  return Object.fromEntries(entries)
}
