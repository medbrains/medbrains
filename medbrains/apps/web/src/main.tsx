/* @refresh reload */
import "./i18n";
import { DirectionProvider, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications, notifications } from "@mantine/notifications";
import { createMedBrainsTheme, cssVariableResolver } from "@medbrains/design-system";
import { createQueryClient } from "@medbrains/stores";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "./App";
import { EcgLoader } from "./components/EcgLoader";
import i18n, { RTL_LANGUAGES } from "./i18n";
import {
  defaultDesktopApiBase,
  getStoredDesktopApiBase,
  isTauriDesktopRuntime,
} from "./lib/desktop-runtime";
import { sessionService } from "./services/session.service";

import "@fontsource-variable/inter-tight";
import "@fontsource-variable/fraunces";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "@medbrains/design-system/styles/global.scss";
import "./styles/signature-spectrum.css";

const theme = createMedBrainsTheme({ loaders: { ecg: EcgLoader } });

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
  __medbrainsReactRenderStats?: Record<
    string,
    { count: number; lastMs: number; totalMs: number; unnecessary: number }
  >;
  __medbrainsReactScan?: Pick<
    typeof import("react-scan"),
    "getOptions" | "getReport" | "setOptions"
  >;
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

const queryClient = createQueryClient({
  // Safety net: any mutation without its own onError surfaces here
  // instead of failing silently (audit P0 #18).
  onMutationError: (error) => {
    notifications.show({
      title: i18n.t("common:notifications.actionFailed", "Action failed"),
      message: error.message || i18n.t("common:notifications.tryAgain", "Please try again."),
      color: "danger",
    });
  },
});

async function enableReactScan() {
  if (!import.meta.env.DEV) {
    return;
  }

  const shouldScan =
    import.meta.env.VITE_REACT_SCAN === "true" ||
    new URLSearchParams(window.location.search).get("reactScan") === "1";
  if (!shouldScan) {
    return;
  }

  const reactScan = await import("react-scan");
  runtimeState.__medbrainsReactRenderStats = {};
  reactScan.scan({
    animationSpeed: "fast",
    enabled: true,
    log: false,
    onRender: (_fiber, renders) => {
      const stats = runtimeState.__medbrainsReactRenderStats ?? {};
      for (const render of renders) {
        const componentName = render.componentName ?? "Anonymous";
        const entry = stats[componentName] ?? {
          count: 0,
          lastMs: 0,
          totalMs: 0,
          unnecessary: 0,
        };
        const renderCount = render.count || 1;
        const durationMs = render.time ?? 0;
        entry.count += renderCount;
        entry.lastMs = durationMs;
        entry.totalMs += durationMs;
        if (render.unnecessary) {
          entry.unnecessary += renderCount;
        }
        stats[componentName] = entry;
      }
      runtimeState.__medbrainsReactRenderStats = stats;
    },
    showToolbar: true,
  });
  runtimeState.__medbrainsReactScan = {
    getOptions: reactScan.getOptions,
    getReport: reactScan.getReport,
    setOptions: reactScan.setOptions,
  };
}

/** Wrapper that sets text direction based on current i18n language */
function AppWithDirection() {
  const { i18n: i18nInstance } = useTranslation();
  const dir = RTL_LANGUAGES.has(i18nInstance.language) ? "rtl" : "ltr";

  return (
    <DirectionProvider initialDirection={dir}>
      <MantineProvider
        theme={theme}
        forceColorScheme="light"
        cssVariablesResolver={cssVariableResolver}
      >
        <ModalsProvider>
          <Notifications position="top-right" autoClose={4000} transitionDuration={250} />
          <App />
        </ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  runtimeState.__medbrainsRoot ??= createRoot(root);
  void enableReactScan().finally(() => {
    runtimeState.__medbrainsRoot?.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <AppWithDirection />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}
