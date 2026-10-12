import { Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { ApiError } from "@medbrains/api";
import { IconScan } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Image } from "@/components/ui";
import { frontOfficeService } from "@/services/frontOffice.service";

const WHY_NOT: Record<string, string> = {
  revoked: "This pass was revoked.",
  expired: "This pass has expired.",
  not_yet_valid: "This pass is not valid yet.",
};

/**
 * The gate: scan a visitor pass (a QR scanner types the code and Enter) and
 * see at once whether it lets this person in now, with the name, ID and
 * photo to match against them, and the ward and bed it opens.
 */
export function GateCheck() {
  const [code, setCode] = useState("");
  const check = useMutation({
    mutationFn: (value: string) => frontOfficeService.scanVisitorPass(value),
  });
  const notFound = check.error instanceof ApiError && check.error.status === 404;
  const pass = check.data;

  return (
    <Stack gap="md" maw={640}>
      <Card withBorder padding="md">
        <Stack
          component="form"
          gap="sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) check.mutate(code.trim());
          }}
        >
          <TextInput
            label="Scan or type the pass number"
            placeholder="VP-…"
            leftSection={<IconScan size={16} />}
            value={code}
            onChange={(event) => setCode(event.currentTarget.value)}
            autoFocus
            data-testid="gate-pass-code"
          />
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={check.isPending} disabled={!code.trim()}>
              Check pass
            </Button>
          </Group>
        </Stack>
      </Card>

      {notFound && (
        <Alert tone="danger" title="No such pass" data-testid="gate-result">
          No pass has this number. Do not let the visitor in on it.
        </Alert>
      )}
      {check.isError && !notFound && (
        <Alert tone="danger" title="Couldn't check the pass">
          The check failed — this is not an answer about the pass. Try again.
        </Alert>
      )}
      {pass && (
        <Card withBorder padding="md" data-testid="gate-result">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4}>
              <Badge tone={pass.valid ? "success" : "danger"} size="lg">
                {pass.valid ? "Valid — let in" : "Not valid"}
              </Badge>
              {!pass.valid && pass.reason && (
                <Text c="red" fw={600}>
                  {WHY_NOT[pass.reason] ?? pass.reason}
                  {pass.revoked_reason ? ` ${pass.revoked_reason}` : ""}
                </Text>
              )}
              <Title order={3}>{pass.visitor_name}</Title>
              <Text size="sm" c="dimmed">
                {[pass.relationship, pass.category].filter(Boolean).join(" · ")}
                {pass.id_type ? ` · ${pass.id_type} ${pass.id_number ?? ""}` : ""}
              </Text>
              <Text size="sm">
                {pass.ward_name ?? "Any ward"}
                {pass.bed_number ? ` · Bed ${pass.bed_number}` : ""} · until{" "}
                {new Date(pass.valid_until).toLocaleString()}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">
                {pass.pass_number}
              </Text>
            </Stack>
            {pass.photo_url && (
              <Image
                src={pass.photo_url}
                alt={`Photo of ${pass.visitor_name}`}
                w={96}
                h={96}
                radius="sm"
              />
            )}
          </Group>
        </Card>
      )}
    </Stack>
  );
}
