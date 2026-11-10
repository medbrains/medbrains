import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { createApi, type Api, type ApiConfig } from './api'

/**
 * Which r8r server the editor talks to.
 *
 * Passed through context rather than imported, so two editors can live on one
 * page pointed at different servers — and so a test can supply a fake without
 * touching the network.
 */
const ApiContext = createContext<Api | null>(null)

export function ApiProvider({
  config,
  api,
  children,
}: {
  config?: ApiConfig
  /** Supply a client directly. Used by tests. */
  api?: Api
  children: ReactNode
}) {
  const value = useMemo(
    () => api ?? createApi(config ?? { baseUrl: '/rest' }),
    [api, config],
  )
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

export function useApi(): Api {
  const api = useContext(ApiContext)
  if (!api) {
    throw new Error('useApi was called outside an <ApiProvider>')
  }
  return api
}
