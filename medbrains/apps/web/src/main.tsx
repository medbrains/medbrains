/* @refresh reload */
import "./i18n";
import { DirectionProvider, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { createQueryClient } from "@medbrains/stores";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "./App";
import { RTL_LANGUAGES } from "./i18n";
import {
  defaultDesktopApiBase,
  getStoredDesktopApiBase,
  isTauriDesktopRuntime,
} from "./lib/desktop-runtime";
import { sessionService } from "./services/session.service";
import { cssVariableResolver, theme } from "./theme";

import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/500.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/schedule/styles.css";
import "./styles/global.scss";

const isTauriDesktop = isTauriDesktopRuntime();
const desktopSearchParams = new URLSearchParams(window.location.search);
const desktopStartRoute = desktopSearchParams.get("desktopStartRoute");
const desktopRuntimeApiBase = desktopSearchParams.get("desktopApiBase")?.trim();
if (isTauriDesktop && desktopStartRoute && window.location.pathname.endsWith("/index.html")) {
  window.history.replaceState(null, "", desktopStartRoute);
}

const desktopApiBase =
  desktopRuntimeApiBase ||
  getStoredDesktopApiBase() ||
  import.meta.env.VITE_DESKTOP_API_BASE ||
  defaultDesktopApiBase();

sessionService.setApiBase(
  import.meta.env.VITE_API_BASE || (isTauriDesktop ? desktopApiBase : "/api"),
);
sessionService.configureNativeAuth(isTauriDesktop ? "desktop" : null);

const runtimeState = globalThis as typeof globalThis & {
  __medbrainsConsoleReporterInstalled?: boolean;
  __medbrainsRoot?: ReturnType<typeof createRoot>;
};
const reportedConsoleMessages = new Set<string>();

function installConsoleErrorReporter() {
  if (runtimeState.__medbrainsConsoleReporterInstalled) {
    return;
  }

  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    originalError(...args);

    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }

        if (typeof arg === "string") {
          return arg;
        }

        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
    if (
      message.includes("The above error occurred in") ||
      message.includes("React will try to recreate this component tree") ||
      message.includes("createRoot() on a container that has already been passed to createRoot()")
    ) {
      return;
    }

    const reportKey = `${window.location.pathname}:${message.slice(0, 160)}`;
    if (reportedConsoleMessages.has(reportKey)) {
      return;
    }
    reportedConsoleMessages.add(reportKey);

    void sessionService
      .reportClientError({
        message: message.slice(0, 500),
        name: "ConsoleError",
        occurred_at: new Date().toISOString(),
        route: window.location.pathname,
        source: "console",
        stack: new Error().stack,
        user_agent: navigator.userAgent,
      })
      .catch(() => undefined);
  };
  runtimeState.__medbrainsConsoleReporterInstalled = true;
}

installConsoleErrorReporter();

const queryClient = createQueryClient();

/** Wrapper that sets text direction based on current i18n language */
function AppWithDirection() {
  const { i18n: i18nInstance } = useTranslation();
  const dir = RTL_LANGUAGES.has(i18nInstance.language) ? "rtl" : "ltr";

  return (
    <DirectionProvider initialDirection={dir}>
      <MantineProvider
        theme={theme}
        defaultColorScheme="light"
        cssVariablesResolver={cssVariableResolver}
      >
        <Notifications position="top-right" autoClose={4000} transitionDuration={250} />
        <App />
      </MantineProvider>
    </DirectionProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  runtimeState.__medbrainsRoot ??= createRoot(root);
  runtimeState.__medbrainsRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppWithDirection />
      </QueryClientProvider>
    </StrictMode>,
  );
}
