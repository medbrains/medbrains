import { Box, Group, Stack, Text } from "@mantine/core";
import { useMergedRef } from "@mantine/hooks";
import { IconEraser } from "@tabler/icons-react";
import { type ComponentPropsWithoutRef, forwardRef, type PointerEvent, useId, useRef } from "react";
import { Button } from "./Button";
import styles from "./signature-pad.module.scss";

export interface SignaturePadProps
  extends Omit<ComponentPropsWithoutRef<"canvas">, "onChange" | "width"> {
  /** Shown above the pad, and its name for assistive technology. */
  label: string;
  /** Stroke width in canvas pixels; a thumb impression draws wider. */
  lineWidth?: number;
  /** After each stroke the drawing as a PNG data URL; `null` once cleared. */
  onChange?: (image: string | null) => void;
}

/** The canvas's own width; CSS stretches it to its container. */
const WIDTH = 460;

/**
 * The one drawing pad for a handwritten signature or mark: a labelled sheet
 * of paper drawn on with a finger, pen or mouse, and a Clear button. The ink
 * takes the sheet's token colour. Drawing cannot be done from the keyboard,
 * so a screen that uses it must offer another way (an upload, or none).
 * `ref` and every other prop go to the `<canvas>`.
 */
export const SignaturePad = forwardRef<HTMLCanvasElement, SignaturePadProps>(function SignaturePad(
  { label, lineWidth = 2, height = 150, onChange, className, ...rest },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const merged = useMergedRef(canvasRef, ref);
  const drawing = useRef(false);
  const labelId = useId();

  /** Where the pointer is, in the canvas's own pixels. */
  const pointAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = rect.width ? event.currentTarget.width / rect.width : 1;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  };
  /** Start a stroke where the pointer went down. */
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointAt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  /** Draw the stroke on to where the pointer is now. */
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = drawing.current ? event.currentTarget.getContext("2d") : null;
    if (!ctx) return;
    const { x, y } = pointAt(event);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    // The canvas resolves this to its own CSS colour: the sheet's ink token.
    ctx.strokeStyle = "currentColor";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  /** End the stroke and hand the drawing so far to the parent. */
  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(canvasRef.current?.toDataURL("image/png") ?? null);
  };
  /** Wipe the sheet. */
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.(null);
  };

  return (
    <Stack gap="xs" className={className}>
      <Text size="sm" fw={500} id={labelId}>
        {label}
      </Text>
      <Box className={styles.paper}>
        <canvas
          {...rest}
          ref={merged}
          role="img"
          aria-labelledby={labelId}
          width={WIDTH}
          height={height}
          className={styles.canvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </Box>
      <Group>
        <Button tone="ghost" size="xs" leftSection={<IconEraser size={16} />} onClick={clear}>
          Clear
        </Button>
      </Group>
    </Stack>
  );
});
SignaturePad.displayName = "SignaturePad";
