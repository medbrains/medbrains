/**
 * The two-sided field mapper.
 *
 * Mapping between systems is the tedious part of integration work, so the
 * editor shows both sides: the fields that actually arrived from the previous
 * node, and the fields the next node expects. Matching them by name gets most
 * rows right, and the rest is one click each.
 */

import type { Items, JsonValue, NodeTypeDescription, Workflow } from '../types'

export interface SourceField {
  /** Dot path into the item, e.g. `customer.address.city`. */
  path: string
  /** What the first item actually held there, for the preview column. */
  sample: JsonValue
  /** `string`, `number`, `boolean`, `object`, `list` or `empty`. */
  kind: string
}

/** How deep to walk before a payload is more noise than help. */
const MAX_DEPTH = 4
const MAX_FIELDS = 200

/**
 * Every field path present in the items, in the order they appear.
 *
 * Derived from real data rather than a declared schema, because the whole
 * point is to show what this API actually sent — including the fields its
 * documentation forgot.
 */
export function fieldPaths(items: Items): SourceField[] {
  const found: SourceField[] = []
  const seen = new Set<string>()

  const walk = (value: JsonValue, prefix: string, depth: number) => {
    if (found.length >= MAX_FIELDS) return

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (depth >= MAX_DEPTH) return
      for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key
        // Record the branch too: mapping a whole object across is valid.
        if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
          record(path, child)
          walk(child, path, depth + 1)
        } else {
          record(path, child)
        }
      }
      return
    }
  }

  const record = (path: string, value: JsonValue) => {
    if (seen.has(path) || found.length >= MAX_FIELDS) return
    seen.add(path)
    found.push({ path, sample: value, kind: kindOf(value) })
  }

  // Sample a handful of items: later items often carry fields the first omits.
  for (const item of items.slice(0, 5)) {
    walk(item, '', 0)
  }
  return found
}

export function kindOf(value: JsonValue): string {
  if (value === null || value === undefined) return 'empty'
  if (Array.isArray(value)) return 'list'
  return typeof value
}

/**
 * The fields the next node expects.
 *
 * For an integration node these are its declared parameters, which is exactly
 * the list a mapping needs to fill. For anything else there is nothing to
 * declare, and the destination is free text.
 */
export function destinationFields(
  workflow: Workflow,
  mapperNodeId: string,
  nodeTypes: readonly NodeTypeDescription[],
): string[] {
  const downstream = workflow.connections
    .filter((connection) => connection.from === mapperNodeId)
    .map((connection) => workflow.nodes.find((node) => node.id === connection.to))
    .filter((node) => node !== undefined)

  const fields: string[] = []
  for (const node of downstream) {
    const description = nodeTypes.find((type) => type.name === node.type)
    if (!description) continue

    for (const property of description.properties) {
      // `resource` and `operation` pick the endpoint; they are not payload.
      if (property.name === 'resource' || property.name === 'operation') continue
      if (!fields.includes(property.name)) fields.push(property.name)
    }
  }
  return fields
}

/**
 * Reduce a field name to what it means, so `customer_name`, `customerName` and
 * `Customer Name` all compare equal.
 */
export function normalizeName(name: string): string {
  const leaf = name.split('.').at(-1) ?? name
  return leaf.replace(/[\s_\-]+/g, '').toLowerCase()
}

export interface Suggestion {
  destination: string
  source: string
  /** `exact` when the names agree, `similar` when one contains the other. */
  confidence: 'exact' | 'similar'
}

/**
 * Match destinations to sources by name.
 *
 * Exact matches are taken first across the whole set, so a weaker partial
 * match can never steal a source that an exact match needs. Each source is
 * used once — mapping one field onto two destinations is a deliberate act, not
 * something to guess at.
 */
export function autoMap(
  destinations: readonly string[],
  sources: readonly SourceField[],
): Suggestion[] {
  const taken = new Set<string>()
  const suggestions: Suggestion[] = []

  const claim = (destination: string, confidence: Suggestion['confidence'], match: SourceField) => {
    taken.add(match.path)
    suggestions.push({ destination, source: match.path, confidence })
  }

  const available = () => sources.filter((source) => !taken.has(source.path))

  for (const destination of destinations) {
    const wanted = normalizeName(destination)
    const match = available().find((source) => normalizeName(source.path) === wanted)
    if (match) claim(destination, 'exact', match)
  }

  for (const destination of destinations) {
    if (suggestions.some((suggestion) => suggestion.destination === destination)) continue

    const wanted = normalizeName(destination)
    const match = available().find((source) => {
      const candidate = normalizeName(source.path)
      return candidate.includes(wanted) || wanted.includes(candidate)
    })
    if (match) claim(destination, 'similar', match)
  }

  return suggestions
}

/** Merge suggestions into the mappings already configured, without overwriting. */
export function applySuggestions(
  current: Readonly<Record<string, JsonValue>>,
  suggestions: readonly Suggestion[],
): Record<string, JsonValue> {
  const next: Record<string, JsonValue> = { ...current }
  for (const suggestion of suggestions) {
    const existing = next[suggestion.destination]
    // A row the user already filled in is theirs; auto-mapping fills gaps.
    if (existing === undefined || existing === '') {
      next[suggestion.destination] = suggestion.source
    }
  }
  return next
}
