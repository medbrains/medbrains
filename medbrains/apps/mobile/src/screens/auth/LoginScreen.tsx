import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { User } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export function LoginScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: (data) => {
      // Store user info - CSRF token is handled by httpOnly cookie
      setAuth({
        id: data.user.id,
        tenant_id: data.user.tenant_id,
        username: data.user.username,
        email: data.user.email,
        full_name: data.user.full_name,
        role: data.user.role as User["role"],
        access_matrix: {},
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
  });

  const handleLogin = () => {
    if (username.trim() && password.trim()) {
      loginMutation.mutate();
    }
  };

  const isValid = username.trim().length >= 3 && password.trim().length >= 4;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Logo & Title */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏥</Text>
          <Text variant="headlineLarge" style={styles.title}>
            MedBrains
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Hospital Management System
          </Text>
        </View>

        {/* Login Form */}
        <Surface style={styles.formCard} elevation={2}>
          <Text variant="titleLarge" style={styles.formTitle}>
            Sign In
          </Text>

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="account" />}
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          {loginMutation.isError && (
            <HelperText type="error" visible>
              Invalid username or password. Please try again.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            disabled={!isValid || loginMutation.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => {
              // Navigate to forgot password
            }}
            style={styles.forgotButton}
          >
            Forgot Password?
          </Button>
        </Surface>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.footerText}>
            Powered by Alagappa Group of Institutions
          </Text>
          <Text variant="labelSmall" style={styles.version}>
            v0.1.0
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  formCard: {
    padding: 24,
    borderRadius: 16,
  },
  formTitle: {
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  forgotButton: {
    marginTop: 16,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    opacity: 0.5,
  },
  version: {
    opacity: 0.3,
    marginTop: 4,
  },
});
