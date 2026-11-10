/**
 * Turning a diff into lines somebody can read.
 *
 * The API answers with structure — nodes added, fields changed, both values.
 * A history list needs sentences. Keeping that translation here rather than in
 * the component means the wording can be tested, and the wording is most of
 * what makes a history useful.
 */
import type { FieldChange, JsonValue, VersionEntry, WorkflowDiff } from '../types'

export type ChangeKind = 'added' | 'removed' | 'edited' | 'rewired' | 'renamed'

export interface ChangeLine {
  readonly kind: ChangeKind
  /** What changed, e.g. `Fetch patients`. */
  readonly subject: string
  /** How it changed, e.g. `timeoutMs 30000 → 1`. Empty when there is nothing
   *  more to say than the subject. */
  readonly detail: string
}

/** How many field changes are spelled out before the rest are counted. */
export const MAX_FIELDS_SHOWN = 4

/** Every change in a diff, as lines, most structural first. */
export function changeLines(diff: WorkflowDiff | null): readonly ChangeLine[] {
  if (!diff) return []

  const lines: ChangeLine[] = []

  if (diff.renamed) {
    lines.push({
      kind: 'renamed',
      subject: 'Workflow',
      detail: `${diff.renamed[0]} → ${diff.renamed[1]}`,
    })
  }

  for (const node of diff.nodesAdded) {
    lines.push({ kind: 'added', subject: node.name, detail: node.kind })
  }
  for (const node of diff.nodesRemoved) {
    lines.push({ kind: 'removed', subject: node.name, detail: node.kind })
  }
  for (const node of diff.nodesChanged) {
    lines.push({ kind: 'edited', subject: node.name, detail: fieldSummary(node.fields) })
  }

  const rewired = diff.connectionsAdded.length + diff.connectionsRemoved.length
  if (rewired > 0) {
    lines.push({
      kind: 'rewired',
      subject: 'Connections',
      detail: rewiring(diff),
    })
  }

  for (const field of diff.settingsChanged) {
    lines.push({ kind: 'edited', subject: 'Settings', detail: fieldLine(field) })
  }

  return lines
}

/**
 * A node's changed fields, spelled out and then counted.
 *
 * Naming every one of thirty changed parameters is not more informative than
 * naming four — it is less, because nobody reads to the end of it.
 */
export function fieldSummary(fields: readonly FieldChange[]): string {
  const shown = fields.slice(0, MAX_FIELDS_SHOWN).map(fieldLine)
  const hidden = fields.length - shown.length

  if (hidden > 0) {
    shown.push(`and ${hidden} more`)
  }
  return shown.join(', ')
}

/** One field, as `path before → after`. */
export function fieldLine(field: FieldChange): string {
  const { path, before, after } = field

  if (before === null || before === undefined) return `${path} set to ${show(after)}`
  if (after === null || after === undefined) return `${path} removed`
  return `${path} ${show(before)} → ${show(after)}`
}

/** How long a value may be before it is cut short. */
const MAX_VALUE_CHARS = 40

/**
 * A value, short enough to sit inside a sentence.
 *
 * Strings keep their quotes so that `"30000"` and `30000` are visibly
 * different — which is exactly the kind of change somebody reads a history to
 * find.
 */
export function show(value: JsonValue | null | undefined): string {
  if (value === null || value === undefined) return 'nothing'

  const text = typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
  if (text.length <= MAX_VALUE_CHARS) return text
  return `${text.slice(0, MAX_VALUE_CHARS - 1)}…`
}

function rewiring(diff: WorkflowDiff): string {
  const parts: string[] = []
  for (const edge of diff.connectionsAdded) {
    parts.push(`+ ${edge.from} → ${edge.to}`)
  }
  for (const edge of diff.connectionsRemoved) {
    parts.push(`− ${edge.from} → ${edge.to}`)
  }
  return parts.join(', ')
}

/**
 * Whether a version is the one the workflow is currently at.
 *
 * The newest version always is, because history is append-only: a restore adds
 * a version rather than moving backwards through them.
 */
export function isCurrent(entry: VersionEntry, versions: readonly VersionEntry[]): boolean {
  return versions.length > 0 && entry.version === versions[0]?.version
}

/**
 * A short, plain rendering of when something happened.
 *
 * A history is read to answer "was this before or after it broke", so recent
 * versions get a relative time and older ones get a date.
 */
export function whenLabel(iso: string, now: Date): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'unknown'

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
