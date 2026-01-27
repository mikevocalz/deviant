/**
 * Error Boundary Component
 * 
 * PHASE 0: Stop the bleeding
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 * 
 * Usage:
 * - Wrap entire app in _layout.tsx
 * - Wrap individual screens that are crash-prone (Profile, PostDetail)
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { AlertTriangle, RefreshCw, Home } from "lucide-react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // Screen name for logging
  screenName?: string;
  // Allow navigation back
  onGoBack?: () => void;
  onGoHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    const screenName = this.props.screenName || "Unknown";
    console.error(`[ErrorBoundary] Crash caught on ${screenName}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({ errorInfo });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send to crash reporting service (Sentry, Bugsnag, etc.)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <AlertTriangle size={48} color="#ef4444" />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.props.screenName
                ? `The ${this.props.screenName} screen encountered an error.`
                : "An unexpected error occurred."}
            </Text>

            {/* Error details (dev only) */}
            {__DEV__ && this.state.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable style={styles.button} onPress={this.handleRetry}>
                <RefreshCw size={20} color="#fff" />
                <Text style={styles.buttonText}>Try Again</Text>
              </Pressable>

              {this.props.onGoHome && (
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={this.props.onGoHome}
                >
                  <Home size={20} color="#fff" />
                  <Text style={styles.buttonText}>Go Home</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Screen-level error boundary wrapper
 * Use this to wrap individual screens that are crash-prone
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary screenName={screenName}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Safe render helper - catches errors during render
 * Use for components that might throw during render
 */
export function SafeRender({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  message: {
    color: "#a3a3a3",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    width: "100%",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "monospace",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#3EA4E5",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButton: {
    backgroundColor: "#333",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
