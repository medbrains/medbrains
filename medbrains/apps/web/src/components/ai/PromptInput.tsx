import { Group, Textarea } from "@mantine/core";
import { IconArrowUp, IconPlayerStop } from "@tabler/icons-react";
import { type KeyboardEvent, useState } from "react";
import { IconButton } from "@/components/ui";
import styles from "./prompt-input.module.scss";

export interface PromptInputProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/** Composer: Enter sends, Shift+Enter newlines; shows a stop control while streaming. */
export function PromptInput({
  onSubmit,
  onStop,
  streaming = false,
  placeholder = "Ask MedBrains…",
  disabled = false,
}: PromptInputProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || streaming) return;
    onSubmit(value);
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Group gap="sm" align="flex-end" wrap="nowrap" className={styles.wrap}>
      <Textarea
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autosize
        minRows={1}
        maxRows={6}
        disabled={disabled}
        aria-label="Message the assistant"
      />
      {streaming ? (
        <IconButton tone="default" aria-label="Stop generating" onClick={onStop}>
          <IconPlayerStop size={16} />
        </IconButton>
      ) : (
        <IconButton
          tone="primary"
          aria-label="Send message"
          onClick={submit}
          disabled={!text.trim() || disabled}
        >
          <IconArrowUp size={16} />
        </IconButton>
      )}
    </Group>
  );
}
