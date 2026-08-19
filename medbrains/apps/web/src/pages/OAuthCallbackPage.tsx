import { Center, Loader, Stack, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { useEffectOnce } from "react-use";
import { oauthService } from "@/services/oauth.service";

const SETTINGS_TARGET = "/admin/settings#oauth-integrations";

/**
 * OAuth redirect landing — the provider returns here with `code` + `state`.
 * Validates the CSRF `state` against the one we stashed before the consent
 * redirect, exchanges the code for tokens, then returns to the settings tab.
 *
 * The exchange is served under `admin.settings.general.manage` and this page
 * deliberately does not re-check it. The call only fires when `oauth_state`
 * and `oauth_provider` are in sessionStorage and the returned state matches,
 * which can only happen if this same browser started the flow from the
 * settings tab under that permission. Gating here would race the permission
 * store: the provider sends a full-page navigation, so `useHasPermission`
 * would read `false` until `/auth/me` resolves and bounce a legitimate
 * callback, discarding the authorization code with it.
 */
export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error");

  const exchange = useMutation({
    mutationFn: (provider: string) =>
      oauthService.exchangeOAuthCode(provider, {
        code: code ?? "",
        redirect_uri: `${window.location.origin}/oauth/callback`,
      }),
    onSettled: () => navigate(SETTINGS_TARGET, { replace: true }),
  });

  useEffectOnce(() => {
    const provider = sessionStorage.getItem("oauth_provider");
    const savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");
    sessionStorage.removeItem("oauth_provider");

    const stateOk = Boolean(returnedState) && returnedState === savedState;
    if (oauthError || !code || !provider || !stateOk) {
      navigate(SETTINGS_TARGET, { replace: true });
      return;
    }
    exchange.mutate(provider);
  });

  return (
    <Center h="60vh">
      <Stack align="center" gap="sm">
        <Loader />
        <Text size="sm" c="dimmed">
          Finishing the connection…
        </Text>
      </Stack>
    </Center>
  );
}
