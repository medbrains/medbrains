import { Box, Center, Group, Loader, Tabs, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'

import { ApiProvider, useApi } from './ApiProvider'
import { type Api, type ApiConfig, describeError } from './api'
import { CredentialsPage } from './components/CredentialsPage'
import { Editor } from './components/Editor'
import { VariablesPage } from './components/VariablesPage'
import { WorkflowList } from './components/WorkflowList'
import type { CredentialTypeDescription, NodeTypeDescription } from './types'

/**
 * Where the editor currently is.
 *
 * Exposed so a host application can drive navigation with its own router. Left
 * alone, the editor keeps its own state and the URL is untouched — which is
 * what a host with its own routing wants.
 */
export type EditorRoute =
  | { view: 'workflows' }
  | { view: 'credentials' }
  | { view: 'variables' }
  | { view: 'editor'; workflowId: string }

export interface AutomationEditorProps {
  /**
   * Where the r8r REST API lives. `/rest` standalone; whatever prefix the host
   * nested it under otherwise, e.g. `/api/automation`.
   */
  apiBase?: string
  /** Merged into every request — a cookie, or an Authorization header. */
  fetchOptions?: RequestInit
  /** Supply a client directly, bypassing `apiBase`. Used by tests. */
  api?: Api
  /** Drive navigation from the host. Omit to let the editor manage its own. */
  route?: EditorRoute
  onRouteChange?: (route: EditorRoute) => void
  /** Hide the tab bar when the host provides its own navigation. */
  withChrome?: boolean
}

/**
 * The whole editor, as one component.
 *
 * Deliberately does not provide a Mantine theme or a notifications portal: the
 * host already has both, and nesting a second `MantineProvider` would override
 * the host's design system with r8r's. The standalone application supplies
 * them; an embedding application supplies its own.
 */
export function AutomationEditor({
  apiBase = '/rest',
  fetchOptions,
  api,
  route,
  onRouteChange,
  withChrome = true,
}: AutomationEditorProps) {
  const config: ApiConfig = { baseUrl: apiBase, fetchOptions }

  return (
    <ApiProvider config={config} api={api}>
      <Shell route={route} onRouteChange={onRouteChange} withChrome={withChrome} />
    </ApiProvider>
  )
}

function Shell({
  route,
  onRouteChange,
  withChrome,
}: {
  route?: EditorRoute
  onRouteChange?: (route: EditorRoute) => void
  withChrome: boolean
}) {
  const api = useApi()
  const [internal, setInternal] = useState<EditorRoute>({ view: 'workflows' })
  const [catalog, setCatalog] = useState<Catalog | null>(null)

  // Controlled when the host passes a route, uncontrolled otherwise.
  const current = route ?? internal
  const navigate = useCallback(
    (next: EditorRoute) => {
      setInternal(next)
      onRouteChange?.(next)
    },
    [onRouteChange],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([api.nodeTypes(), api.credentialTypes()])
      .then(([nodeTypes, credentialTypes]) => {
        if (!cancelled) setCatalog({ nodeTypes, credentialTypes })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setCatalog({ nodeTypes: [], credentialTypes: [] })
        notifications.show({
          color: 'red',
          title: 'Could not reach the automation server',
          message: describeError(cause),
        })
      })
    return () => {
      cancelled = true
    }
  }, [api])

  if (catalog === null) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }

  if (current.view === 'editor') {
    return (
      <Editor
        workflowId={current.workflowId}
        nodeTypes={catalog.nodeTypes}
        credentialTypes={catalog.credentialTypes}
        onBack={() => navigate({ view: 'workflows' })}
      />
    )
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {withChrome && (
        <Group
          px="md"
          pt={10}
          gap="md"
          align="flex-end"
          style={{ borderBottom: '1px solid var(--line)', flex: '0 0 auto' }}
        >
          <Tabs
            value={current.view}
            onChange={(view) => navigate(routeFor(view))}
            styles={{ root: { border: 0 }, list: { border: 0 } }}
          >
            <Tabs.List>
              <Tabs.Tab value="workflows">Workflows</Tabs.Tab>
              <Tabs.Tab value="credentials">Credentials</Tabs.Tab>
              <Tabs.Tab value="variables">Variables</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Text size="xs" c="dimmed" ml="auto" pb={12}>
            {catalog.nodeTypes.length} nodes · {catalog.credentialTypes.length} credential types
          </Text>
        </Group>
      )}

      <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {current.view === 'workflows' && (
          <WorkflowList onOpen={(workflowId) => navigate({ view: 'editor', workflowId })} />
        )}
        {current.view === 'credentials' && (
          <CredentialsPage credentialTypes={catalog.credentialTypes} />
        )}
        {current.view === 'variables' && <VariablesPage />}
      </Box>
    </Box>
  )
}

/** The tab bar only names top-level views; anything else goes to workflows. */
function routeFor(view: string | null): EditorRoute {
  if (view === 'credentials') return { view: 'credentials' }
  if (view === 'variables') return { view: 'variables' }
  return { view: 'workflows' }
}

interface Catalog {
  nodeTypes: NodeTypeDescription[]
  credentialTypes: CredentialTypeDescription[]
}
