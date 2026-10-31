import { useMemo, useState } from 'react'
import { ActionIcon, Group, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCopy, IconSearch, IconX } from '@tabler/icons-react'

import { filterLines, logLines, toPlainText, type LogLevel } from '../domain/logs'
import type { RunResult, Workflow } from '../types'

const LEVELS: LogLevel[] = ['info', 'warn', 'error', 'debug']

/**
 * A terminal for the run.
 *
 * Deliberately console-shaped — monospace, fixed columns, level in the
 * gutter — because that is the format anyone debugging a pipeline already
 * knows how to read.
 */
export function LogConsole({
  workflow,
  result,
  mode,
  onClose,
}: {
  workflow: Workflow
  result: RunResult
  mode?: string
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState<ReadonlySet<LogLevel>>(
    // Debug lines carry the payloads; off until asked for, or the console is
    // unreadable at a glance.
    new Set<LogLevel>(['info', 'warn', 'error']),
  )
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())

  const all = useMemo(() => logLines(workflow, result, { mode }), [workflow, result, mode])
  const shown = useMemo(
    () => filterLines(all, { levels: enabled, query }),
    [all, enabled, query],
  )

  const toggleLevel = (level: LogLevel) =>
    setEnabled((current) => {
      const next = new Set(current)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })

  return (
    <div className="log-console" data-testid="log-console">
      <Group px="sm" py={6} gap="xs" wrap="nowrap" className="log-console-bar">
        <Text className="eyebrow">Console</Text>

        <Group gap={4} wrap="nowrap">
          {LEVELS.map((level) => (
            <button
              type="button"
              key={level}
              className={`log-level-toggle level-${level}${enabled.has(level) ? ' is-on' : ''}`}
              aria-pressed={enabled.has(level)}
              onClick={() => toggleLevel(level)}
            >
              {level}
            </button>
          ))}
        </Group>

        <TextInput
          aria-label="Filter log"
          placeholder="Filter"
          size="xs"
          w={190}
          leftSection={<IconSearch size={12} stroke={1.8} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />

        <Text size="xs" c="dimmed" className="metric">
          {shown.length}/{all.length}
        </Text>

        <Group gap={2} ml="auto" wrap="nowrap">
          <Tooltip label="Copy the console">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Copy log"
              onClick={() => void navigator.clipboard?.writeText(toPlainText(shown))}
            >
              <IconCopy size={13} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Close console"
            onClick={onClose}
          >
            <IconX size={13} stroke={1.8} />
          </ActionIcon>
        </Group>
      </Group>

      {/* A plain scroller: Mantine's ScrollArea makes its content a table,
          which collapses the fixed columns this console depends on. */}
      <div className="log-scroll">
        <div className="log-lines">
          {shown.length === 0 && (
            <div className="log-empty">Nothing matches the current filter.</div>
          )}

          {shown.map((line, index) => {
            const open = expanded.has(index)
            return (
              <div key={index} className={`log-line level-${line.level}`}>
                <button
                  type="button"
                  className="log-line-head"
                  disabled={!line.detail}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (next.has(index)) {
                        next.delete(index)
                      } else {
                        next.add(index)
                      }
                      return next
                    })
                  }
                >
                  <span className="stamp">+{line.elapsedMs}ms</span>
                  <span className="level">{line.level}</span>
                  <span className="scope">{line.scope}</span>
                  <span className="message">{line.message}</span>
                  {line.detail && <span className="chevron">{open ? '▾' : '▸'}</span>}
                </button>
                {open && line.detail && <pre className="log-detail">{line.detail}</pre>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
