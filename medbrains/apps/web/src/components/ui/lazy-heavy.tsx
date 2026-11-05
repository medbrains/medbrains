import { Skeleton } from "@mantine/core";
import { lazy, Suspense } from "react";
import type { FloorMapProps } from "./FloorMap";
import type { RichTextEditorProps } from "./RichTextEditor";

// The seam is imported by nearly every page, so anything it exports directly loads before any
// page opens. These two pull in echarts and the rich-text editor: about 2.5 MB of source that
// most people never use, so they load only when one is on screen.
const LazyFloorMap = lazy(() => import("./FloorMap").then((m) => ({ default: m.FloorMap })));
const LazyRichTextEditor = lazy(() =>
  import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
);

const FLOOR_MAP_PLACEHOLDER_HEIGHT = 320;
const EDITOR_PLACEHOLDER_HEIGHT = 160;

/** The floor map, loaded on first use. See `FloorMap`. */
export function FloorMap(props: FloorMapProps) {
  return (
    <Suspense fallback={<Skeleton height={FLOOR_MAP_PLACEHOLDER_HEIGHT} />}>
      <LazyFloorMap {...props} />
    </Suspense>
  );
}

/** The rich-text editor, loaded on first use. See `RichTextEditor`. */
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<Skeleton height={EDITOR_PLACEHOLDER_HEIGHT} />}>
      <LazyRichTextEditor {...props} />
    </Suspense>
  );
}
