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
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: value,
    editable: !readOnly,
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
      {!readOnly && (
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
      <MantineRichTextEditor.Content aria-label={ariaLabel} style={{ minHeight }} />
    </MantineRichTextEditor>
  );
}
