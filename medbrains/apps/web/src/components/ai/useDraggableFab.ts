import { useLocalStorage } from "@mantine/hooks";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

const FAB_SIZE = 60;
const MARGIN = 16;
const DRAG_THRESHOLD = 6;

/** Persisted dock position: a horizontal edge + a vertical offset (null = bottom). */
type FabPos = { side: "left" | "right"; top: number | null };

/**
 * Makes the floating launcher draggable: drag it anywhere, it snaps to the
 * nearest left/right edge on release and the position persists. A plain click
 * (no drag) still activates it, and keyboard activation is unaffected.
 */
export function useDraggableFab(onActivate: () => void) {
  const [pos, setPos] = useLocalStorage<FabPos>({
    key: "ai-fab-pos",
    defaultValue: { side: "right", top: null },
    getInitialValueInEffect: false,
  });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const info = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const justDragged = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    info.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = info.current;
    if (!d) return;
    if (
      !d.moved &&
      Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD
    ) {
      return;
    }
    d.moved = true;
    setDrag({ x: e.clientX - d.offsetX, y: e.clientY - d.offsetY });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = info.current;
    info.current = null;
    setDrag(null);
    if (!d || !d.moved) return; // a plain click falls through to onClick
    justDragged.current = true;
    const side = e.clientX < window.innerWidth / 2 ? "left" : "right";
    const top = Math.min(
      Math.max(e.clientY - d.offsetY, MARGIN),
      window.innerHeight - FAB_SIZE - MARGIN,
    );
    setPos({ side, top });
  };

  const onClick = () => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    onActivate();
  };

  const style: CSSProperties = drag
    ? { left: drag.x, top: drag.y, right: "auto", bottom: "auto", cursor: "grabbing" }
    : {
        left: pos.side === "left" ? MARGIN : "auto",
        right: pos.side === "right" ? MARGIN : "auto",
        top: pos.top ?? "auto",
        bottom: pos.top === null ? MARGIN : "auto",
      };

  return { style, onPointerDown, onPointerMove, onPointerUp, onClick };
}
