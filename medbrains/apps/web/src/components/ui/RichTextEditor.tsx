import { Link, RichTextEditor as MantineRichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

export interface RichTextEditorProps {
  /** Controlled HTML value. */
  value?: string;
  /** Called with the editor HTML on every change. */
  onChange?: (html: string) => void;
  /** Accessible name for the editing surface. */
  ariaLabel?: string;
  /** Min height of the editing area (px). */
  minHeight?: number;
  /** Render read-only (no toolbar interactions). */
  readOnly?: boolean;
  /** "compact" keeps bold, italic and lists — for several editors on one screen. */
  toolbar?: "full" | "compact";
}

/**
 * Carbon-clean rich-text editor for large text (clinical notes, summaries,
 * CMS). Wraps @mantine/tiptap; colour/typography come from the theme tokens.
 * Toolbar is limited to StarterKit + Link controls so no extension is missing.
 */
export function RichTextEditor({
  value = "",
  onChange,
  ariaLabel,
  minHeight = 180,
  readOnly = false,
  toolbar = "full",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: value,
    editable: !readOnly,
    // The name goes on the editable element itself — the textbox a screen
    // reader lands on — not on the wrapper around it.
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(readOnly ? { "aria-readonly": "true" } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => onChange?.(instance.getHTML()),
  });

  // Sync external value changes into the editor (external-system integration).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <MantineRichTextEditor editor={editor}>
      {!readOnly && toolbar === "compact" && (
        <MantineRichTextEditor.Toolbar>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.BulletList />
            <MantineRichTextEditor.OrderedList />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>
      )}
      {!readOnly && toolbar === "full" && (
        <MantineRichTextEditor.Toolbar sticky stickyOffset={0}>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.Strikethrough />
            <MantineRichTextEditor.ClearFormatting />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.H2 />
            <MantineRichTextEditor.H3 />
            <MantineRichTextEditor.BulletList />
            <MantineRichTextEditor.OrderedList />
            <MantineRichTextEditor.Blockquote />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Link />
            <MantineRichTextEditor.Unlink />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>
      )}
      <MantineRichTextEditor.Content style={{ minHeight }} />
    </MantineRichTextEditor>
  );
}
