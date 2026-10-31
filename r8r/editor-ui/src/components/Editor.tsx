import { Box, Center, Loader, Paper, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node as FlowNodeType,
  ReactFlow,
} from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import { indexRuns, inputOf, itemsOnWire } from '../domain/execution'
import { edgeId } from '../domain/graph'
import { destinationFields } from '../domain/mapping'
import { useWorkflowEditor } from '../hooks/useWorkflowEditor'
import type { CredentialTypeDescription, NodeTypeDescription } from '../types'
import { EditorToolbar } from './EditorToolbar'
import { ExecutionsPanel } from './ExecutionsPanel'
import { FlowEdge, type FlowEdgeData } from './FlowEdge'
import { FlowNode, type FlowNodeData } from './FlowNode'
import { HistoryPanel } from './HistoryPanel'
import { LogConsole } from './LogConsole'
import { NodeDetailView } from './NodeDetailView'
import { NodePalette } from './NodePalette'
import { RunSummary } from './RunSummary'

const flowNodeTypes = { r8r: FlowNode }
const flowEdgeTypes = { wire: FlowEdge }

/** How long the completion pulse runs before the wires go quiet again. */
const PULSE_MS = 1100

export function Editor({
  workflowId,
  nodeTypes,
  credentialTypes,
  onBack,
}: {
  workflowId: string
  nodeTypes: readonly NodeTypeDescription[]
  credentialTypes: readonly CredentialTypeDescription[]
  onBack: () => void
}) {
  const editor = useWorkflowEditor(workflowId)
  const { workflow, result, selectedId } = editor
  const [openNodeId, setOpenNodeId] = useState<string | null>(null)
  const [pulsing, setPulsing] = useState(false)
  const [showRuns, setShowRuns] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [openExecutionId, setOpenExecutionId] = useState<string | undefined>()
  const [showConsole, setShowConsole] = useState(false)

  const typeMap = useMemo(() => new Map(nodeTypes.map((type) => [type.name, type])), [nodeTypes])
  const runs = useMemo(() => indexRuns(result), [result])

  // Errors surface as toasts; the hook only records the latest one.
  useEffect(() => {
    if (editor.error) notifications.show({ color: 'red', message: editor.error })
  }, [editor.error])

  // A single travelling dash when a run lands, then the canvas settles.
  useEffect(() => {
    if (!result) return
    setPulsing(true)
    const timer = window.setTimeout(() => setPulsing(false), PULSE_MS)
    return () => window.clearTimeout(timer)
  }, [result])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        void editor.save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor.save])

  const flowNodes: FlowNodeType<FlowNodeData>[] = useMemo(
    () =>
      (workflow?.nodes ?? []).map((node) => ({
        id: node.id,
        type: 'r8r',
        position: { x: node.position[0], y: node.position[1] },
        selected: node.id === selectedId,
        data: { node, description: typeMap.get(node.type), run: runs.get(node.id) },
      })),
    [workflow?.nodes, selectedId, typeMap, runs],
  )

  const flowEdges: Edge<FlowEdgeData>[] = useMemo(
    () =>
      (workflow?.connections ?? []).map((connection) => ({
        id: edgeId(connection),
        type: 'wire',
        source: connection.from,
        target: connection.to,
        sourceHandle: connection.port,
        data: { items: itemsOnWire(runs, connection), pulse: pulsing },
      })),
    [workflow?.connections, runs, pulsing],
  )

  if (workflow === null) {
    return (
      <Center h="100%">
        {editor.busy === 'loading' ? <Loader size="sm" /> : <Text c="dimmed">Not found.</Text>}
      </Center>
    )
  }

  const openNode = workflow.nodes.find((node) => node.id === openNodeId)

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorToolbar
        workflow={workflow}
        dirty={editor.dirty}
        busy={editor.busy}
        onBack={onBack}
        onRename={editor.rename}
        onSave={() => void editor.save()}
        onRun={() => void editor.run()}
        onSetActive={(active) => void editor.setActive(active)}
        runsOpen={showRuns}
        onToggleRuns={() => {
          setShowRuns((open) => !open)
          setShowHistory(false)
        }}
        historyOpen={showHistory}
        onToggleHistory={() => {
          setShowHistory((open) => !open)
          setShowRuns(false)
        }}
      />

      <Box style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Paper w={220} radius={0} className="palette-rail">
          <NodePalette
            nodeTypes={nodeTypes}
            onAdd={(type) => {
              const id = editor.addNode(type)
              // Open it straight away: a node you just added always needs
              // configuring, and the canvas cannot show you its parameters.
              setOpenNodeId(id)
            }}
          />
        </Paper>

        <div className="canvas-wrap" data-testid="canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={flowNodeTypes}
            edgeTypes={flowEdgeTypes}
            onNodesChange={editor.applyNodeChanges}
            onEdgesChange={editor.applyEdgeChanges}
            onConnect={(params) =>
              editor.connect(params.source, params.target, params.sourceHandle)
            }
            onNodeClick={(_, node) => editor.select(node.id)}
            onNodeDoubleClick={(_, node) => setOpenNodeId(node.id)}
            onPaneClick={() => editor.select(null)}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1c2430" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>

          {workflow.nodes.length === 0 && (
            <div className="canvas-empty">
              <Text size="sm" fw={600}>
                Start with a trigger
              </Text>
              <Text size="xs" c="dimmed">
                Pick one from the left, then chain nodes onto it.
              </Text>
            </div>
          )}
        </div>

        {showRuns && (
          <ExecutionsPanel
            workflowId={workflowId}
            selectedId={openExecutionId}
            onOpen={(executionId) => {
              setOpenExecutionId(executionId)
              void editor.loadExecution(executionId)
            }}
            onClose={() => setShowRuns(false)}
          />
        )}

        {showHistory && (
          <HistoryPanel
            workflowId={workflowId}
            onRestored={() => void editor.reload()}
            onClose={() => setShowHistory(false)}
          />
        )}
      </Box>

      {result && (
        <RunSummary
          result={result}
          consoleOpen={showConsole}
          onToggleConsole={() => setShowConsole((open) => !open)}
          onClose={() => {
            editor.clearResult()
            setShowConsole(false)
          }}
        />
      )}

      {result && showConsole && (
        <LogConsole workflow={workflow} result={result} onClose={() => setShowConsole(false)} />
      )}

      {openNode && (
        <NodeDetailView
          node={openNode}
          description={typeMap.get(openNode.type)}
          credentialTypes={credentialTypes}
          input={inputOf(workflow, runs, openNode.id)}
          destinations={destinationFields(workflow, openNode.id, nodeTypes)}
          run={runs.get(openNode.id)}
          executing={editor.busy === 'running'}
          onPatch={(patch) => editor.patchNode(openNode.id, patch)}
          onDelete={() => {
            editor.removeNode(openNode.id)
            setOpenNodeId(null)
          }}
          onExecute={() => void editor.run()}
          onClose={() => setOpenNodeId(null)}
        />
      )}
    </Box>
  )
}
