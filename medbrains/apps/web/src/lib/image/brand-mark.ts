/**
 * Turns a picked image into a brand mark the branding settings can store:
 * drawn onto a canvas no larger than the mark's box, exported as WebP (PNG
 * where the browser cannot encode WebP), as a data URL. Redrawing drops
 * EXIF and any other metadata the file carried, and bounds the size, so the
 * stored value is small enough for the header and every card.
 */

/** The box a mark is drawn within, in pixels. */
export interface MarkBox {
  maxWidth: number;
  maxHeight: number;
}

/** The emblem: square-ish, 256 px on its longest side. */
export const EMBLEM_BOX: MarkBox = { maxWidth: 256, maxHeight: 256 };

/** The name banner: wide, up to 600 px across. */
export const NAME_BANNER_BOX: MarkBox = { maxWidth: 600, maxHeight: 200 };

/** The largest image a mark may be once encoded. */
export const MAX_MARK_BYTES = 200 * 1024;

/** The largest file the picker will open; a bigger one is refused before decoding. */
export const MAX_PICKED_BYTES = 5 * 1024 * 1024;

/** The types a picked file may be. No SVG: it can carry script. */
export const MARK_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** A mark ready to save, or why the file was refused. */
export type MarkResult = { dataUrl: string } | { problem: string };

/** The size that fits `width`×`height` in the box, keeping its shape; never enlarged. */
export function fitWithin(width: number, height: number, box: MarkBox) {
  const scale = Math.min(1, box.maxWidth / width, box.maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The bytes a base64 data URL decodes to. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return (
    Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0)
  );
}

/** Loads a picked file as an image element. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    image.src = url;
  });
}

/** Draws the image into the box and exports it, WebP first, PNG as the fallback. */
function encode(image: HTMLImageElement, box: MarkBox): string | null {
  const size = fitWithin(image.naturalWidth, image.naturalHeight, box);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, size.width, size.height);
  const webp = canvas.toDataURL("image/webp", 0.9);
  // A browser that cannot encode WebP silently hands back PNG; either is fine.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/** Reads a picked file into a mark for `box`, or says why it cannot be one. */
export async function readBrandMark(file: File, box: MarkBox): Promise<MarkResult> {
  if (!MARK_TYPES.includes(file.type)) {
    return { problem: "Choose a PNG, JPEG or WebP image. SVG and other files are not accepted." };
  }
  if (file.size > MAX_PICKED_BYTES) {
    return { problem: "That file is over 5 MB. Choose a smaller image." };
  }
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { problem: "That image could not be read. Try saving it again as PNG." };
  }
  const dataUrl = encode(image, box);
  if (!dataUrl) return { problem: "This browser cannot resize images. Try another browser." };
  if (dataUrlBytes(dataUrl) > MAX_MARK_BYTES) {
    return { problem: "The image is still over 200 KB after resizing. Use a simpler image." };
  }
  return { dataUrl };
}
