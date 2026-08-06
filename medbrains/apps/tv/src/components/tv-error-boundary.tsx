/**
 * Keeps a waiting-room screen from going white.
 *
 * A TV board runs unattended for weeks. There is no one standing next to it to
 * reload the page, and nobody notices a crash until a patient asks the desk why
 * the screen is blank. React unmounts the whole tree on a render error, so one
 * bad field in one token turns the board off.
 *
 * This is the tenth commandment of the device-surface rules — fail safe, never
 * blank — and the TV app had no boundary anywhere.
 *
 * A boundary cannot re-render the crashed subtree safely, so it shows the room
 * something honest and legible from across it, and keeps retrying: whatever
 * broke was usually one bad payload, and the next poll normally fixes it.
 */

import { COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";

/** Long enough not to thrash on a persistent fault, short enough to self-heal. */
const RETRY_INTERVAL_MS = 30_000;

export interface TvErrorBoundaryProps {
  /** Named so an operator reading a photo of the screen knows which board died. */
  boardName: string;
  children: ReactNode;
}

interface TvErrorBoundaryState {
  failedAt: number | null;
}

export class TvErrorBoundary extends Component<TvErrorBoundaryProps, TvErrorBoundaryState> {
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(props: TvErrorBoundaryProps) {
    super(props);
    this.state = { failedAt: null };
  }

  static getDerivedStateFromError(): TvErrorBoundaryState {
    return { failedAt: Date.now() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Goes to the device log, which is what an engineer has to work from when
    // the only other evidence is a photograph of a screen.
    console.error(`[tv-board:${this.props.boardName}] render failed`, error, info.componentStack);
  }

  componentDidUpdate(): void {
    if (this.state.failedAt !== null && this.retryTimer === null) {
      this.retryTimer = setInterval(() => this.setState({ failedAt: null }), RETRY_INTERVAL_MS);
    }
    if (this.state.failedAt === null) {
      this.clearTimer();
    }
  }

  componentWillUnmount(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.retryTimer !== null) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  render(): ReactNode {
    if (this.state.failedAt === null) {
      return this.props.children;
    }

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.brandDeep,
          justifyContent: "center",
          gap: SPACING.md,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 44, fontWeight: "700" }}>
          This board is being restored
        </Text>
        <Text style={{ color: "#ffffff", opacity: 0.85, fontSize: 28 }}>
          Please ask at the desk for your turn. The screen will come back on its own.
        </Text>
        <Text style={{ color: "#ffffff", opacity: 0.6, fontSize: 20 }}>{this.props.boardName}</Text>
      </View>
    );
  }
}
