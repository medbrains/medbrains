import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { cssVariableResolver, theme } from "../theme";

interface RenderWithRouteOptions extends Omit<RenderOptions, "wrapper"> {
  /** Initial pathname (e.g. "/patients/<uuid>") for MemoryRouter. */
  initialEntries?: string[];
  /** Reuse an existing QueryClient (for advanced tests with mutations). */
  queryClient?: QueryClient;
}

function newQueryClient(): QueryClient {
  // Tests must not retry — failures should surface immediately.
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function makeProviders(client: QueryClient, initialEntries: string[]) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={cssVariableResolver}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

/**
 * Render a component wrapped in Mantine + TanStack Query + Router.
 * Use this for page-level tests that need data fetching + navigation.
 */
function customRender(ui: ReactElement, options: RenderWithRouteOptions = {}) {
  const { initialEntries = ["/"], queryClient = newQueryClient(), ...rest } = options;
  return render(ui, { wrapper: makeProviders(queryClient, initialEntries), ...rest });
}

export { customRender as render };
export { screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
