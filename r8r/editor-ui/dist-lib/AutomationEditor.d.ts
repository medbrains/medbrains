import { Api } from './api';
/**
 * Where the editor currently is.
 *
 * Exposed so a host application can drive navigation with its own router. Left
 * alone, the editor keeps its own state and the URL is untouched — which is
 * what a host with its own routing wants.
 */
export type EditorRoute = {
    view: 'workflows';
} | {
    view: 'credentials';
} | {
    view: 'editor';
    workflowId: string;
};
export interface AutomationEditorProps {
    /**
     * Where the r8r REST API lives. `/rest` standalone; whatever prefix the host
     * nested it under otherwise, e.g. `/api/automation`.
     */
    apiBase?: string;
    /** Merged into every request — a cookie, or an Authorization header. */
    fetchOptions?: RequestInit;
    /** Supply a client directly, bypassing `apiBase`. Used by tests. */
    api?: Api;
    /** Drive navigation from the host. Omit to let the editor manage its own. */
    route?: EditorRoute;
    onRouteChange?: (route: EditorRoute) => void;
    /** Hide the tab bar when the host provides its own navigation. */
    withChrome?: boolean;
}
/**
 * The whole editor, as one component.
 *
 * Deliberately does not provide a Mantine theme or a notifications portal: the
 * host already has both, and nesting a second `MantineProvider` would override
 * the host's design system with r8r's. The standalone application supplies
 * them; an embedding application supplies its own.
 */
export declare function AutomationEditor({ apiBase, fetchOptions, api, route, onRouteChange, withChrome, }: AutomationEditorProps): import("react").JSX.Element;
