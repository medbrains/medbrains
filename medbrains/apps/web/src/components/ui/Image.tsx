import { Image as MantineImage, type ImageProps as MantineImageProps } from "@mantine/core";
import { forwardRef } from "react";

export interface ImageProps extends MantineImageProps {
  /** Native alt text — required for accessibility (WCAG 2.1 AA). */
  alt: string;
  /** Native `<img loading>` — defaults to "lazy". */
  loading?: "eager" | "lazy";
  /** Native `<img decoding>` — defaults to "async". */
  decoding?: "sync" | "async" | "auto";
}

/**
 * Standard image surface. Wraps Mantine `Image` and defaults to the
 * performance-safe behaviour every `<img>` should have but raw tags don't:
 * - `loading="lazy"` — below-the-fold images don't block first paint.
 * - `decoding="async"` — decode off the main thread.
 * - `fallbackSrc` — a graceful placeholder on broken/missing URLs.
 *
 * Always pass `w`/`h` (or an aspect ratio via the wrapping layout) to reserve
 * space and avoid layout shift (CLS). `alt` is mandatory.
 *
 * Use this instead of a raw `<img>` (project rule: no hand-rolled HTML).
 */
const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23e9ecef'/%3E%3C/svg%3E";

export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { loading = "lazy", decoding = "async", fallbackSrc = FALLBACK, ...rest },
  ref,
) {
  return (
    <MantineImage
      ref={ref}
      loading={loading}
      decoding={decoding}
      fallbackSrc={fallbackSrc}
      {...rest}
    />
  );
});
Image.displayName = "Image";
