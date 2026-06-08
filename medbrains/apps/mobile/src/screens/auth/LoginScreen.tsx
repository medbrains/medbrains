import { zodResolver } from "@hookform/resolvers/zod";
import { type MobileLoginFormInput, mobileLoginFormSchema } from "@medbrains/schemas";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import type { User } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, HelperText, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";
import { mobileLoginText } from "./loginText";

function loginFieldErrorText(message: string | undefined): string | undefined {
  if (!message) return undefined;

  const translated = mobileLoginText(message);
  return translated === message ? message : translated;
}

export function LoginScreen() {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();
  const setPermissions = usePermissionStore((state) => state.setPermissions);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MobileLoginFormInput>({
    resolver: zodResolver(mobileLoginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const username = watch("username");
  const password = watch("password");

  const loginMutation = useMutation({
    mutationFn: authService.login,
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
      setPermissions(data.user.role, data.permissions, data.field_access);
    },
  });

  const handleLogin = handleSubmit((values) => {
    loginMutation.mutate(values);
  });

  const isValid = username.trim().length >= 3 && password.trim().length >= 4;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <BrandMark />
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.primary }]}>
            {mobileLoginText("auth.login.brand.name")}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurface }]}>
            {mobileLoginText("auth.login.product.subtitle")}
          </Text>
        </View>

        <Surface style={styles.formCard} elevation={2}>
          <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
            {mobileLoginText("auth.login.action.signIn")}
          </Text>

          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <TextInput
                label={mobileLoginText("auth.login.form.username")}
                value={field.value}
                onChangeText={field.onChange}
                mode="outlined"
                error={Boolean(errors.username)}
                autoCapitalize="none"
                autoCorrect={false}
                left={<TextInput.Icon icon="account" />}
                style={styles.input}
              />
            )}
          />
          {errors.username?.message && (
            <HelperText type="error" visible>
              {loginFieldErrorText(errors.username.message)}
            </HelperText>
          )}

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextInput
                label={mobileLoginText("auth.login.form.password")}
                value={field.value}
                onChangeText={field.onChange}
                mode="outlined"
                error={Boolean(errors.password)}
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
            )}
          />
          {errors.password?.message && (
            <HelperText type="error" visible>
              {loginFieldErrorText(errors.password.message)}
            </HelperText>
          )}

          {loginMutation.isError && (
            <HelperText type="error" visible>
              {mobileLoginText("auth.login.errors.invalidCredentials")}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={() => void handleLogin()}
            loading={loginMutation.isPending}
            disabled={!isValid || loginMutation.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {mobileLoginText("auth.login.action.signIn")}
          </Button>

          <Button
            mode="text"
            onPress={() => {
              // Navigate to forgot password
            }}
            style={styles.forgotButton}
          >
            {mobileLoginText("auth.login.action.forgotPassword")}
          </Button>
        </Surface>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.footerText}>
            {mobileLoginText("auth.login.footer.poweredBy")}
          </Text>
          <Text variant="labelSmall" style={styles.version}>
            {mobileLoginText("auth.login.footer.version")}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BrandMark() {
  return (
    <View style={styles.logoTile}>
      <Text variant="headlineMedium" style={styles.logoText}>
        {mobileLoginText("auth.login.brand.initials")}
      </Text>
      <View style={styles.logoAccent} />
    </View>
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
  logoTile: {
    width: 74,
    height: 74,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MEDBRAINS_COLORS.brand,
    marginBottom: 16,
  },
  logoText: {
    color: MEDBRAINS_COLORS.canvas,
    fontWeight: "700",
  },
  logoAccent: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: MEDBRAINS_COLORS.copper,
    marginTop: 4,
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
