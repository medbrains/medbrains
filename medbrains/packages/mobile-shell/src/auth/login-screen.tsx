/**
 * `LoginScreen` — variant-agnostic login form. Hosts pass a
 * `signIn` callback that hits their auth endpoint (staff JWT,
 * patient ABHA, etc.) and returns a `TenantIdentity`. The screen
 * persists the JWT via the configured SecretStore on success.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Image, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { MobileTextField } from "@medbrains/ui-mobile";
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

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secretStore = useSecretStore();
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(identifier, password);
      await signIn(secretStore, result.identity, result.refreshToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

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
      <MobileTextField
        label={identifierLabel}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 12 }}
      />
      <MobileTextField
        label={passwordLabel}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        containerStyle={{ marginBottom: 8 }}
      />
      {error && (
        <HelperText type="error" visible style={{ marginBottom: 8 }}>
          {error}
        </HelperText>
      )}
      <Button
        mode="contained"
        loading={submitting}
        disabled={submitting || !identifier || !password}
        onPress={handleSubmit}
        style={{ marginTop: 8 }}
      >
        Sign in
      </Button>
      {footer && <View style={{ marginTop: 24 }}>{footer}</View>}
    </Surface>
  );
}
