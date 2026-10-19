import { Code } from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import { IconArrowLeft, IconHome, IconMapQuestion, IconSearch } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui";
import { ErrorScreen } from "./ErrorScreen";

/**
 * Any address inside the app that no screen answers. Deliberately unguarded:
 * it says nothing about records, only that this address has no page.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // The first entry of a session has key "default": "back" would leave the app.
  const canGoBack = location.key !== "default";

  return (
    <ErrorScreen
      eyebrow="404 · page not found"
      title="There is no page at this address"
      description="The link may be old, mistyped, or the page may have moved to another module. Nothing has been changed."
      icon={<IconMapQuestion size={32} />}
      tone="info"
      actions={
        <>
          {canGoBack && (
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
            >
              Go back
            </Button>
          )}
          <Button
            tone="primary"
            onClick={() => navigate("/dashboard")}
            leftSection={<IconHome size={16} />}
          >
            Go to dashboard
          </Button>
          <Button tone="ghost" leftSection={<IconSearch size={16} />} onClick={spotlight.open}>
            Search for a page
          </Button>
        </>
      }
    >
      <Code>{location.pathname}</Code>
    </ErrorScreen>
  );
}
