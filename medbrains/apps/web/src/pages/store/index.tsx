/**
 * The hospital pharmacy's storefront, open to anyone: browse what the
 * pharmacy sells online, then sign in with a mobile to order. Somebody who
 * isn't a patient yet becomes a pharmacy customer at sign-in. The session is
 * the portal's — the same patient token, the same separate storage.
 */

import { Loader, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { Alert, Button, Card } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import {
  clearPortalSession,
  readPortalSession,
  type StoredPortalSession,
} from "../portal/portal-session";
import { StoreBrowse } from "./store-browse";
import { StoreFooter } from "./store-footer";
import { StoreSignIn } from "./store-sign-in";
import { StoreSignedIn } from "./store-signed-in";

export function StorePage() {
  const { tenantCode = "" } = useParams<{ tenantCode: string }>();
  const [session, setSession] = useState<StoredPortalSession | null>(() => readPortalSession());
  const about = useQuery({
    queryKey: ["store-about", tenantCode],
    queryFn: () => portalService.getStoreAbout(tenantCode),
  });

  return (
    <Stack align="center" gap="md" p="lg" mx="auto" maw={720} mih="100vh">
      <Title order={2}>{about.data?.pharmacy_name ?? "Pharmacy"}</Title>
      {about.isLoading && <Loader size="sm" />}
      {(about.isError || (about.data && !about.data.open)) && (
        <Alert tone="info" title="The pharmacy isn't taking orders online">
          Visit the pharmacy counter at the hospital.
        </Alert>
      )}
      {about.data?.open &&
        (session ? (
          <>
            <StoreSignedIn tenantCode={tenantCode} token={session.token} />
            <Button
              tone="secondary"
              onClick={() => {
                clearPortalSession();
                setSession(null);
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Card padding="md" w="100%">
              <StoreSignIn tenantCode={tenantCode} onSignedIn={setSession} />
            </Card>
            <Text size="sm" c="dimmed" w="100%">
              Browse without signing in. You'll need to sign in to order.
            </Text>
            <StoreBrowse tenantCode={tenantCode} />
          </>
        ))}
      {about.data && <StoreFooter about={about.data} />}
    </Stack>
  );
}
