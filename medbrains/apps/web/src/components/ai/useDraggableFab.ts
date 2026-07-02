import { useLocalStorage } from "@mantine/hooks";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

const MARGIN = 16;
const DRAG_THRESHOLD = 6;

/** Persisted dock: one of the four corners. */
type FabPos = { side: "left" | "right"; vert: "top" | "bottom" };

/**
 * Makes the floating launcher draggable: drag it anywhere, and on release it
 * snaps to the NEAREST of the four corners (by quadrant); the choice persists.
 * A plain click (no drag) still activates it; keyboard activation is unaffected.
 */
export function useDraggableFab(onActivate: () => void) {
  const [pos, setPos] = useLocalStorage<FabPos>({
    key: "ai-fab-pos",
    defaultValue: { side: "right", vert: "bottom" },
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
    // Snap to the nearest corner by which quadrant it was dropped in.
    const side = e.clientX < window.innerWidth / 2 ? "left" : "right";
    const vert = e.clientY < window.innerHeight / 2 ? "top" : "bottom";
    setPos({ side, vert });
  };

  const onClick = () => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    onActivate();
  };

  // Background/radius set inline so they beat Mantine's UnstyledButton reset
  // (which otherwise leaves the launcher transparent → shows the page bg).
  const base: CSSProperties = {
    background: "var(--mb-brand-emphasis, #0f62fe)",
    borderRadius: 16,
  };
  const style: CSSProperties = drag
    ? { ...base, left: drag.x, top: drag.y, right: "auto", bottom: "auto", cursor: "grabbing" }
    : {
        ...base,
        left: pos.side === "left" ? MARGIN : "auto",
        right: pos.side === "right" ? MARGIN : "auto",
        top: pos.vert === "top" ? MARGIN : "auto",
        bottom: pos.vert === "bottom" ? MARGIN : "auto",
      };

  return { style, onPointerDown, onPointerMove, onPointerUp, onClick };
}
