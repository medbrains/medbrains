import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconHome, IconRefresh } from "@tabler/icons-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { useLocation } from "react-router";
import { sessionService } from "../services/session.service";

type BoundaryState = {
  error: Error | null;
  reportStatus: "idle" | "sending" | "sent" | "failed";
};

type BoundaryProps = {
  children: ReactNode;
  resetKey: string;
  pathname: string;
};

function isIgnoredDevClientError(error: unknown): boolean {
  if (isBenignBrowserRuntimeError(error)) {
    return true;
  }

  if (!import.meta.env.DEV) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("WebSocket closed without opened") ||
    message.includes("[vite] failed to connect to websocket") ||
    message.includes("@vitejs/plugin-react can't detect preamble")
  );
}

function isBenignBrowserRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("ResizeObserver loop limit exceeded") ||
    message.includes("ResizeObserver loop completed with undelivered notifications")
  );
}

class AppErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    error: null,
    reportStatus: "idle",
  };

  private hasReported = false;

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.hasReported = false;
      this.setState({ error: null, reportStatus: "idle" });
    }
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.reportError(error, errorInfo);
  }

  handleWindowError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    if (isIgnoredDevClientError(error)) {
      event.preventDefault();
      return;
    }

    if (this.state.error) {
      return;
    }

    this.setState({
      error,
    });
    this.reportError(error);
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error =
      reason instanceof Error ? reason : new Error(String(reason ?? "Unexpected background error"));
    if (isIgnoredDevClientError(error)) {
      return;
    }

    if (this.state.error) {
      return;
    }

    this.setState({
      error,
    });
    this.reportError(error);
  };

  reportError(error: Error, errorInfo?: ErrorInfo) {
    if (this.hasReported) {
      return;
    }

    this.hasReported = true;
    this.setState({ reportStatus: "sending" });

    void sessionService
      .reportClientError({
        component_stack: errorInfo?.componentStack ?? undefined,
        message: error.message,
        name: error.name,
        occurred_at: new Date().toISOString(),
        route: this.props.pathname,
        source: "ui",
        stack: error.stack,
        user_agent: navigator.userAgent,
      })
      .then(() => this.setState({ reportStatus: "sent" }))
      .catch((reportError: unknown) => {
        console.warn("Client error report failed", reportError);
        this.setState({ reportStatus: "failed" });
      });
  }

  render() {
    const { error, reportStatus } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <Container size="md" py="xl">
        <Paper withBorder radius="md" p="xl">
          <Stack gap="lg">
            <Alert
              color="danger"
              icon={<IconAlertTriangle size={18} />}
              title="This screen hit an unexpected error"
              variant="light"
            >
              <Text size="sm">
                Your session is still active. Reload this screen or return to the dashboard while
                support reviews the report.
              </Text>
            </Alert>

            <Stack gap={4}>
              <Title order={2}>Screen unavailable</Title>
              <Text c="dimmed" size="sm">
                Route: {this.props.pathname}
              </Text>
              <Text c={reportStatus === "failed" ? "warning" : "dimmed"} size="sm">
                {reportStatus === "sent" && "A crash report was sent automatically."}
                {reportStatus === "sending" && "Sending crash report..."}
                {reportStatus === "failed" &&
                  "The screen is protected, but the automatic report could not be sent."}
                {reportStatus === "idle" && "Crash report is being prepared."}
              </Text>
            </Stack>

            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={() => window.location.reload()}
              >
                Reload screen
              </Button>
              <Button
                leftSection={<IconHome size={16} />}
                onClick={() => window.location.assign("/dashboard")}
                variant="light"
              >
                Dashboard
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    );
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AppErrorBoundaryInner pathname={location.pathname} resetKey={location.key}>
      {children}
    </AppErrorBoundaryInner>
  );
}
