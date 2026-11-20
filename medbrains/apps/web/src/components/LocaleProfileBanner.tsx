import { Group, Text } from "@mantine/core";
import { useHasPermission, useLocaleProfile, useLocaleProfileStatus } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useNavigate } from "react-router";
import { Alert, Button } from "@/components/ui";

/** Fields whose absence changes what every screen shows. */
const ESSENTIAL = ["country", "currency", "timezone"] as const;

/**
 * Says when the locale profile did not load, or is missing a country,
 * currency or time zone. Screens then render neutrally (ISO codes, UTC
 * labelled) instead of guessing a country (RFC-WORLD-READY §2.3).
 */
export function LocaleProfileBanner() {
  const status = useLocaleProfileStatus();
  const profile = useLocaleProfile();
  const canFix = useHasPermission(P.ADMIN.LOCALE_PROFILE.UPDATE);
  const navigate = useNavigate();

  if (status === "failed") {
    return (
      <Alert tone="danger" role="alert" title="Hospital settings did not load">
        Dates show in UTC and amounts without a currency until they do. Reload the page to try
        again.
      </Alert>
    );
  }
  const missing = ESSENTIAL.filter((k) => profile?.missing.includes(k));
  if (status !== "ready" || missing.length === 0) return null;
  return (
    <Alert tone="warning" title="This hospital's locale profile is incomplete">
      <Group justify="space-between" gap="md">
        <Text size="sm" miw={0} style={{ flex: "1 1 20rem" }}>
          Not set: {missing.join(", ")}. Until it is, those show neutrally.
        </Text>
        {canFix && (
          <Button
            tone="ghost"
            size="compact-sm"
            onClick={() => void navigate("/admin/settings#locale-profile")}
          >
            Set it
          </Button>
        )}
      </Group>
    </Alert>
  );
}
