/**
 * The r8r editor, as a library.
 *
 * Mount it inside another application:
 *
 * ```tsx
 * import { AutomationEditor } from '@r8r/editor'
 * import '@r8r/editor/styles.css'
 *
 * <AutomationEditor apiBase="/api/automation" fetchOptions={{ credentials: 'include' }} />
 * ```
 *
 * The host supplies the `MantineProvider` and the `Notifications` portal, so
 * the editor inherits the host's design system rather than imposing r8r's. It
 * must also import xyflow's stylesheet, which is a peer dependency:
 *
 * ```ts
 * import '@xyflow/react/dist/style.css'
 * ```
 */

// Imported here so the library build emits it; consumers pull it in explicitly
// as `@r8r/editor/styles.css` to control ordering against their own styles.
import './styles.css'


export { AutomationEditor } from './AutomationEditor'
export type { AutomationEditorProps, EditorRoute } from './AutomationEditor'

export { ApiProvider, useApi } from './ApiProvider'
export { createApi, ApiError, describeError } from './api'
export type { Api, ApiConfig } from './api'

/** The theme r8r uses standalone, for a host that wants the same look. */
export { theme as r8rTheme } from './theme'

export type * from './types'
