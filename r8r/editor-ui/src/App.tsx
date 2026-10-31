import { Box, Group, Text } from '@mantine/core'
import { useEffect, useState } from 'react'

import { AutomationEditor, type EditorRoute } from './AutomationEditor'

/**
 * The standalone application.
 *
 * Everything here is what r8r-on-its-own needs and an embedding host does not:
 * the brand, and hash routing so a reload lands back where you were. The editor
 * itself is the library component, so the two deployments cannot drift.
 */
export function App() {
  const [route, setRoute] = useState<EditorRoute>(fromHash)

  useEffect(() => {
    const onHashChange = () => setRoute(fromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {route.view !== 'editor' && (
        <Group px="md" py={10} style={{ borderBottom: '1px solid var(--line)', flex: '0 0 auto' }}>
          <Text fw={700} size="lg" style={{ letterSpacing: '-0.02em' }}>
            r8<span style={{ color: 'var(--signal)' }}>r</span>
          </Text>
        </Group>
      )}

      <Box style={{ flex: 1, minHeight: 0 }}>
        <AutomationEditor
          apiBase="/rest"
          route={route}
          onRouteChange={(next) => {
            window.location.hash = toHash(next)
            setRoute(next)
          }}
        />
      </Box>
    </Box>
  )
}

function fromHash(): EditorRoute {
  const editing = window.location.hash.match(/^#\/workflow\/(.+)$/)
  if (editing?.[1]) return { view: 'editor', workflowId: editing[1] }
  if (window.location.hash === '#/credentials') return { view: 'credentials' }
  return { view: 'workflows' }
}

function toHash(route: EditorRoute): string {
  switch (route.view) {
    case 'editor':
      return `#/workflow/${route.workflowId}`
    case 'credentials':
      return '#/credentials'
    default:
      return '#/'
  }
}
