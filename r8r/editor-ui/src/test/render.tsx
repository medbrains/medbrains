/** Render a component inside the same providers the real app uses. */

import type { ReactElement } from 'react'
import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiProvider } from '../ApiProvider'
import type { Api } from '../api'
import { theme } from '../theme'
import { fakeApi } from './fakeApi'

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { api?: Api },
) {
  const api = options?.api ?? fakeApi()

  return {
    user: userEvent.setup(),
    api,
    ...render(ui, {
      wrapper: ({ children }) => (
        <MantineProvider theme={theme} defaultColorScheme="dark" forceColorScheme="dark">
          <ApiProvider api={api}>{children}</ApiProvider>
        </MantineProvider>
      ),
      ...options,
    }),
  }
}

export { fakeApi }

export * from '@testing-library/react'
