import { AutomationEditor, type EditorRoute } from '@r8r/editor'
import '@r8r/editor/styles.css'
import '@xyflow/react/dist/style.css'

/**
 * Where the automation API is mounted inside this application.
 *
 * Matches the prefix `medbrains-server` nests `medbrains-automation-api` under.
 * When automation runs as its own service this is the address of that service
 * instead, and nothing else about this component changes.
 */
const DEFAULT_API_BASE = '/api/automation'

export interface AutomationScreenProps {
  /** Override when automation is deployed as a separate service. */
  apiBase?: string
  /** Drive navigation from the app's router. Omitted, the editor manages it. */
  route?: EditorRoute
  onRouteChange?: (route: EditorRoute) => void
}

export function AutomationScreen({
  apiBase = DEFAULT_API_BASE,
  route,
  onRouteChange,
}: AutomationScreenProps) {
  return (
    <AutomationEditor
      apiBase={apiBase}
      // The session is a cookie on this origin, so the editor authenticates
      // the way every other screen does: by sending it. It never sees a token.
      fetchOptions={{ credentials: 'include' }}
      route={route}
      onRouteChange={onRouteChange}
      // The app shell already provides navigation; the editor's own tab bar
      // would be a second one on the same screen.
      withChrome={false}
    />
  )
}
