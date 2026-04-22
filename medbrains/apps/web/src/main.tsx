import "./i18n";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { setApiBase } from "@medbrains/api";
import { createQueryClient } from "@medbrains/stores";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { theme, cssVariableResolver } from "./theme";

import "@fontsource-variable/inter-tight/index.css";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/schedule/styles.css";
import "./styles/global.scss";

setApiBase(import.meta.env.VITE_API_BASE || "/api");

const queryClient = createQueryClient();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={cssVariableResolver}>
          <Notifications position="top-right" autoClose={4000} transitionDuration={250} />
          <App />
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
