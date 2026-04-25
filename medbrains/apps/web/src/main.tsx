import "./i18n";
import { DirectionProvider, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { setApiBase } from "@medbrains/api";
import { createQueryClient } from "@medbrains/stores";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "./App";
import { theme, cssVariableResolver } from "./theme";
import { RTL_LANGUAGES } from "./i18n";

import "@fontsource-variable/inter-tight/index.css";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/schedule/styles.css";
import "./styles/global.scss";

setApiBase(import.meta.env.VITE_API_BASE || "/api");

const queryClient = createQueryClient();

/** Wrapper that sets text direction based on current i18n language */
function AppWithDirection() {
  const { i18n: i18nInstance } = useTranslation();
  const dir = RTL_LANGUAGES.has(i18nInstance.language) ? "rtl" : "ltr";

  return (
    <DirectionProvider initialDirection={dir}>
      <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={cssVariableResolver}>
        <Notifications position="top-right" autoClose={4000} transitionDuration={250} />
        <App />
      </MantineProvider>
    </DirectionProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppWithDirection />
      </QueryClientProvider>
    </StrictMode>,
  );
}
