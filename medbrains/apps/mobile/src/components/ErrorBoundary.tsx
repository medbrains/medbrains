import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level error boundary — fail-safe per DEVICE-CONSTRAINED-RULES (never a
 * white screen). Catches render/lifecycle errors below it and shows a
 * recoverable fallback instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for the RN dev/log pipeline; production crash-reporting hooks here.
    if (__DEV__) {
      console.error("[ErrorBoundary]", error.message, info.componentStack);
    }
  }

  private readonly reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text variant="titleMedium" style={styles.title}>
            Something went wrong
          </Text>
          <Text variant="bodySmall" style={styles.message}>
            The screen hit an unexpected error. You can try again.
          </Text>
          <Button mode="contained" onPress={this.reset}>
            Try again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { marginBottom: 8 },
  message: { textAlign: "center", marginBottom: 16, opacity: 0.7 },
});
