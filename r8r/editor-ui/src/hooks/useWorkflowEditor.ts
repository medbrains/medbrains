/**
 * All editor state and every mutation that can happen to a workflow.
 *
 * Keeping this out of the component means the editing rules can be tested
 * directly, without rendering a canvas.
 */

import type { EdgeChange, NodeChange } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../ApiProvider'
import { describeError } from '../api'
import {
  addConnection,
  buildNode,
  canConnect,
  connectionFrom,
  isDirty,
  removeNode as removeNodeFrom,
  snapshot,
} from '../domain/graph'
import type { NodeTypeDescription, RunResult, Workflow, WorkflowNode } from '../types'

export type EditorBusy = 'loading' | 'saving' | 'running' | null

export interface WorkflowEditor {
  workflow: Workflow | null
  selectedId: string | null
  result: RunResult | null
  busy: EditorBusy
  dirty: boolean
  error: string | null

  select: (id: string | null) => void
  rename: (name: string) => void
  addNode: (type: NodeTypeDescription) => string
  patchNode: (id: string, patch: Partial<WorkflowNode>) => void
  removeNode: (id: string) => void
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  connect: (source: string | null, target: string | null, sourceHandle: string | null) => void

  save: () => Promise<void>
  /** Discard the canvas and take the workflow from the server again. */
  reload: () => Promise<void>
  run: () => Promise<void>
  /** Load a past run back onto the canvas. */
  loadExecution: (executionId: string) => Promise<void>
  setActive: (active: boolean) => Promise<void>
  clearResult: () => void
}

/** `crypto.randomUUID` is not available over plain HTTP on some hosts. */
function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `n${Date.now()}${Math.random().toString(16).slice(2)}`
}

export function useWorkflowEditor(workflowId: string): WorkflowEditor {
  const api = useApi()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [saved, setSaved] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState<EditorBusy>('loading')
  const [error, setError] = useState<string | null>(null)

  const adopt = useCallback((loaded: Workflow) => {
    setWorkflow(loaded)
    setSaved(snapshot(loaded))
  }, [])

  /**
   * Pull the workflow from the server again, discarding what is on the canvas.
   *
   * Used after a restore: the canvas is holding the version that was just
   * replaced, and leaving it there would let the next save undo the restore.
   */
  const reload = useCallback(async () => {
    setBusy('loading')
    try {
      adopt(await api.getWorkflow(workflowId))
      setError(null)
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(null)
    }
  }, [api, workflowId, adopt])

  useEffect(() => {
    let cancelled = false
    setBusy('loading')
    api
      .getWorkflow(workflowId)
      .then((loaded) => {
        if (cancelled) return
        adopt(loaded)
        setBusy(null)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describeError(cause))
        setBusy(null)
      })
    return () => {
      cancelled = true
    }
  }, [workflowId, adopt])

  // ------------------------------------------------------------ mutations

  const rename = useCallback((name: string) => {
    setWorkflow((current) => (current === null ? current : { ...current, name }))
  }, [])

  const patchNode = useCallback((id: string, patch: Partial<WorkflowNode>) => {
    setWorkflow((current) =>
      current === null
        ? current
        : {
            ...current,
            nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
          },
    )
  }, [])

  const removeNode = useCallback((id: string) => {
    setWorkflow((current) => (current === null ? current : removeNodeFrom(current, id)))
    setSelectedId((current) => (current === id ? null : current))
  }, [])

  /** Returns the new node's id so the caller can open it straight away. */
  const addNode = useCallback((type: NodeTypeDescription) => {
    const id = newId()
    setWorkflow((current) =>
      current === null
        ? current
        : { ...current, nodes: [...current.nodes, buildNode(type, current.nodes, id)] },
    )
    setSelectedId(id)
    return id
  }, [])

  const applyNodeChanges = useCallback((changes: NodeChange[]) => {
    setWorkflow((current) => {
      if (current === null) return current
      let next = current
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { x, y } = change.position
          next = {
            ...next,
            nodes: next.nodes.map((node) =>
              node.id === change.id ? { ...node, position: [x, y] as const } : node,
            ),
          }
        } else if (change.type === 'remove') {
          next = removeNodeFrom(next, change.id)
        }
      }
      return next
    })
  }, [])

  const applyEdgeChanges = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id)
    if (removed.length === 0) return
    setWorkflow((current) => {
      if (current === null) return current
      const survivors = current.connections.filter(
        (connection) => !removed.includes(`${connection.from}|${connection.port}|${connection.to}`),
      )
      return { ...current, connections: survivors }
    })
  }, [])

  const connect = useCallback(
    (source: string | null, target: string | null, sourceHandle: string | null) => {
      if (!canConnect(source, target) || source === null || target === null) return
      setWorkflow((current) =>
        current === null
          ? current
          : {
              ...current,
              connections: addConnection(
                current.connections,
                connectionFrom(source, target, sourceHandle),
              ),
            },
      )
    },
    [],
  )

  // ------------------------------------------------------------- commands

  const save = useCallback(async () => {
    if (workflow === null) return
    setBusy('saving')
    try {
      adopt(await api.updateWorkflow(workflow.id, workflow))
      setError(null)
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(null)
    }
  }, [workflow, adopt])

  const run = useCallback(async () => {
    if (workflow === null) return
    setBusy('running')
    setResult(null)
    try {
      // Runs the canvas as it stands, so unsaved edits can be tried out.
      const response = await api.runUnsaved(workflow)
      setResult(response.result)
      setError(response.result.status === 'error' ? (response.result.error ?? null) : null)
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(null)
    }
  }, [workflow])

  const loadExecution = useCallback(async (executionId: string) => {
    try {
      const stored = await api.getExecution(executionId)
      // Showing a past run reuses the same canvas readout as a live one, so
      // debugging yesterday's failure looks exactly like debugging today's.
      setResult(stored.data)
      setError(null)
    } catch (cause) {
      setError(describeError(cause))
    }
  }, [])

  const setActive = useCallback(
    async (active: boolean) => {
      if (workflow === null) return
      try {
        // Activating publishes what is on screen, so save first if it differs.
        if (isDirty(workflow, saved)) await api.updateWorkflow(workflow.id, workflow)
        adopt(await api.setActive(workflow.id, active))
        setError(null)
      } catch (cause) {
        setError(describeError(cause))
      }
    },
    [workflow, saved, adopt],
  )

  return {
    workflow,
    selectedId,
    result,
    busy,
    dirty: isDirty(workflow, saved),
    error,
    select: setSelectedId,
    rename,
    addNode,
    patchNode,
    removeNode,
    applyNodeChanges,
    applyEdgeChanges,
    connect,
    save,
    reload,
    run,
    loadExecution,
    setActive,
    clearResult: () => setResult(null),
  }
}
