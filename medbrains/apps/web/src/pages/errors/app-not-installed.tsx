import { BRICK_MANIFESTS } from "@medbrains/types";
import { IconApps, IconArrowLeft, IconHome } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui";
import { ErrorScreen } from "./ErrorScreen";

interface AppNotInstalledPageProps {
  /** The app brick's `module_config.code`. */
  brick: string;
}

/**
 * What a screen of a switched-off app shows instead of itself. A hospital that runs only some
 * apps must not land on a broken screen when a link or bookmark points at one it does not have,
 * and must not read it as a fault or a missing permission either.
 */
export function AppNotInstalledPage({ brick }: AppNotInstalledPageProps) {
  const navigate = useNavigate();
  const name = BRICK_MANIFESTS[brick]?.name ?? "This app";
  return (
    <ErrorScreen
      eyebrow="Not installed"
      title={`${name} isn't part of this hospital's MedBrains`}
      description="Your administrator can add it in Settings, Modules. Nothing was opened or changed."
      icon={<IconApps size={32} />}
      tone="neutral"
      actions={
        <>
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
          <Button
            tone="ghost"
            leftSection={<IconHome size={16} />}
            onClick={() => navigate("/dashboard")}
          >
            Go to dashboard
          </Button>
        </>
      }
    />
  );
}
