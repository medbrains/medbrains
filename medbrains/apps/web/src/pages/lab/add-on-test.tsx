// Lab AddOnTestSection — split from lab.tsx (pure move).

import { Group, TextInput } from "@mantine/core";
import { useState } from "react";
import { Button } from "@/components/ui";

export function AddOnTestSection({
  onAddOn,
  isPending,
}: {
  onAddOn: (testId: string) => void;
  isPending: boolean;
}) {
  const [testId, setTestId] = useState("");
  return (
    <Group mt="sm">
      <TextInput
        size="xs"
        placeholder="Test ID for add-on"
        value={testId}
        onChange={(e) => setTestId(e.currentTarget.value)}
        w={250}
      />
      <Button
        tone="secondary"
        size="xs"
        disabled={!testId}
        loading={isPending}
        onClick={() => {
          onAddOn(testId);
          setTestId("");
        }}
      >
        Add-on Test
      </Button>
    </Group>
  );
}

// ══════════════════════════════════════════════════════════
//  Test Catalog Tab (enhanced with Phase 2 fields)
// ══════════════════════════════════════════════════════════
