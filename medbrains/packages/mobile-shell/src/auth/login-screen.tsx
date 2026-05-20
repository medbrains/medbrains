/**
 * `LoginScreen` — variant-agnostic login form. Hosts pass a
 * `signIn` callback that hits their auth endpoint (staff JWT,
 * patient ABHA, etc.) and returns a `TenantIdentity`. The screen
 * persists the JWT via the configured SecretStore on success.
 */

import type { ReactNode } from "react";
import { Image, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mobileShellLoginFormSchema,
  type MobileShellLoginFormInput,
} from "@medbrains/schemas";
import { MobileTextField } from "@medbrains/ui-mobile";
import { Controller, useForm } from "react-hook-form";
import { Button, HelperText, Surface, Text } from "react-native-paper";
import { FOREST_COPPER_PALETTE } from "../theme/forest-copper.js";
import type { TenantIdentity } from "../types.js";
import { useAuthStore } from "./auth-store.js";
import { useSecretStore } from "./auth-provider.js";

export interface LoginScreenProps {
  title?: string;
  subtitle?: string;
  identifierLabel?: string;
  passwordLabel?: string;
  logoSource?: ImageSourcePropType;
  onSubmit: (
    identifier: string,
    password: string,
  ) => Promise<{ identity: TenantIdentity; refreshToken?: string }>;
  footer?: ReactNode;
}

export function LoginScreen(props: LoginScreenProps): ReactNode {
  const {
    title = "MedBrains",
    subtitle = "Sign in to continue",
    identifierLabel = "Username or email",
    passwordLabel = "Password",
    logoSource,
    onSubmit,
    footer,
  } = props;

  const secretStore = useSecretStore();
  const signIn = useAuthStore((s) => s.signIn);
  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MobileShellLoginFormInput>({
    resolver: zodResolver(mobileShellLoginFormSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const identifier = watch("identifier");
  const password = watch("password");

  const submit = handleSubmit(async (values) => {
    try {
      const result = await onSubmit(values.identifier, values.password);
      await signIn(secretStore, result.identity, result.refreshToken);
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Sign in failed",
      });
    }
  });

  return (
    <Surface
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: FOREST_COPPER_PALETTE.canvas,
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 18 }}>
        {logoSource ? (
          <Image
            source={logoSource}
            resizeMode="contain"
            style={{
              width: 74,
              height: 74,
              borderRadius: 16,
            }}
          />
        ) : (
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: FOREST_COPPER_PALETTE.brand,
            }}
          >
            <Text
              variant="headlineMedium"
              style={{ color: FOREST_COPPER_PALETTE.canvas, fontWeight: "700" }}
            >
              MB
            </Text>
          </View>
        )}
      </View>
      <View style={{ marginBottom: 32 }}>
        <Text
          variant="displaySmall"
          style={{ color: FOREST_COPPER_PALETTE.brand, marginBottom: 8 }}
        >
          {title}
        </Text>
        <Text variant="bodyLarge" style={{ color: FOREST_COPPER_PALETTE.ink }}>
          {subtitle}
        </Text>
      </View>
      <Controller
        control={control}
        name="identifier"
        render={({ field }) => (
          <MobileTextField
            label={identifierLabel}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ marginBottom: 12 }}
            errorText={errors.identifier?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <MobileTextField
            label={passwordLabel}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            containerStyle={{ marginBottom: 8 }}
            errorText={errors.password?.message}
            required
          />
        )}
      />
      {errors.root?.message && (
        <HelperText type="error" visible style={{ marginBottom: 8 }}>
          {errors.root.message}
        </HelperText>
      )}
      <Button
        mode="contained"
        loading={isSubmitting}
        disabled={isSubmitting || !identifier || !password}
        onPress={() => void submit()}
        style={{ marginTop: 8 }}
      >
        Sign in
      </Button>
      {footer && <View style={{ marginTop: 24 }}>{footer}</View>}
    </Surface>
  );
}
