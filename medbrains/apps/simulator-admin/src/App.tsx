import { Alert, Box, Button, Container, PasswordInput, Stack, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SimulatorAdmin } from "./SimulatorAdmin";

export function App() {
  const meQuery = useQuery({
    queryKey: ["sim-admin-me"],
    queryFn: () => api.me(),
    retry: false,
  });

  if (meQuery.isLoading) {
    return (
      <Container size="sm" py="xl">
        <Title order={3}>Loading…</Title>
      </Container>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return <LoginScreen onAuthed={() => meQuery.refetch()} />;
  }

  const role = meQuery.data?.role;
  const isBypass = role === "super_admin" || role === "hospital_admin";
  if (!isBypass) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" variant="light">
          Simulator is restricted to super_admin / hospital_admin. Current role:{" "}
          <strong>{role ?? "unknown"}</strong>.
        </Alert>
      </Container>
    );
  }

  return (
    <Box p="md">
      <SimulatorAdmin />
    </Box>
  );
}

function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login({ username, password });
      onAuthed();
    } catch (err) {
      notifications.show({
        title: "Login failed",
        message: (err as Error).message,
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Title order={2} mb="md">
        MedBrains Simulator
      </Title>
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
            autoFocus
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
          <Button type="submit" loading={busy}>
            Sign in
          </Button>
          <Alert color="yellow" variant="light">
            Super-admin / hospital-admin only. Activity created here is tagged{" "}
            <strong>is_dummy = true</strong> and must be excluded from regulator reports.
          </Alert>
        </Stack>
      </form>
    </Container>
  );
}
