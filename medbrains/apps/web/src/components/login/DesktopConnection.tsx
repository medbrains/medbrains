import { Box, TextInput, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import {
  defaultDesktopApiBase,
  getStoredDesktopApiBase,
  normalizeDesktopApiBase,
  setStoredDesktopApiBase,
} from "@/lib/desktop-runtime";
import classes from "@/pages/login.module.scss";
import { sessionService } from "@/services/session.service";

/** The desktop app's server address: test it, save it, or reset it. */
export function DesktopConnection() {
  const defaultApiBase = defaultDesktopApiBase();
  const [opened, disclosure] = useDisclosure(false);
  const [apiBase, setApiBase] = useState(
    getStoredDesktopApiBase() ?? sessionService.getApiBase() ?? defaultApiBase,
  );
  const [status, setStatus] = useState<{ color: "danger" | "success"; message: string } | null>(
    null,
  );
  const normalized = normalizeDesktopApiBase(apiBase);
  const missing = () => setStatus({ color: "danger", message: "Enter a backend URL or /api." });

  const save = () => {
    if (!normalized) return missing();
    setStoredDesktopApiBase(normalized);
    sessionService.setApiBase(normalized);
    window.location.reload();
  };
  const reset = () => {
    setStoredDesktopApiBase(null);
    setApiBase(defaultApiBase);
    sessionService.setApiBase(defaultApiBase);
    window.location.reload();
  };
  const test = async () => {
    if (!normalized) return missing();
    setStatus(null);
    try {
      await sessionService.testHealthAtBase(normalized);
      setStatus({ color: "success", message: "Backend health check passed." });
    } catch (error) {
      setStatus({
        color: "danger",
        message: error instanceof Error ? error.message : "Connection failed.",
      });
    }
  };

  return (
    <Box className={classes.desktopSetup}>
      <UnstyledButton
        className={classes.desktopSetupToggle}
        onClick={disclosure.toggle}
        aria-expanded={opened}
        aria-controls="desktop-setup-panel"
      >
        Desktop connection setup
      </UnstyledButton>
      {opened && (
        <Box id="desktop-setup-panel" className={classes.desktopSetupPanel}>
          <TextInput
            label="Backend API URL"
            description="Use /api for local dev, or enter a vendor / on-prem server URL."
            placeholder="https://hospital.example.com/api"
            value={apiBase}
            onChange={(event) => {
              setApiBase(event.currentTarget.value);
              setStatus(null);
            }}
            size="sm"
          />
          <Box className={classes.desktopSetupActions}>
            <Button tone="secondary" size="xs" onClick={test}>
              Test
            </Button>
            <Button tone="primary" size="xs" onClick={save}>
              Save & reload
            </Button>
            <Button tone="ghost" size="xs" onClick={reset}>
              Reset
            </Button>
          </Box>
          {status && (
            <Alert tone={status.color} radius="md">
              {status.message}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
}
