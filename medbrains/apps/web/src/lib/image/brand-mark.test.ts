import { afterEach, describe, expect, it, vi } from "vitest";
import { dataUrlBytes, EMBLEM_BOX, fitWithin, NAME_BANNER_BOX, readBrandMark } from "./brand-mark";

/** A picked file of this type and size; the bytes are never decoded by jsdom. */
function picked(type: string, size = 10): File {
  return new File([new Uint8Array(size)], "mark", { type });
}

/** Makes `new Image()` load as a `width`×`height` picture and the canvas hand back `dataUrl`. */
function stubBrowser(width: number, height: number, dataUrl: string) {
  const drawn: { width: number; height: number }[] = [];
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    drawn.push({ width: this.width, height: this.height });
    return { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(dataUrl);
  return drawn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fitWithin", () => {
  it("shrinks into the box keeping the shape, never enlarges", () => {
    expect(fitWithin(1024, 512, EMBLEM_BOX)).toEqual({ width: 256, height: 128 });
    expect(fitWithin(300, 900, EMBLEM_BOX)).toEqual({ width: 85, height: 256 });
    expect(fitWithin(100, 50, EMBLEM_BOX)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(2400, 300, NAME_BANNER_BOX)).toEqual({ width: 600, height: 75 });
  });
});

describe("readBrandMark", () => {
  it("refuses SVG and anything that is not PNG, JPEG or WebP", async () => {
    for (const type of ["image/svg+xml", "text/html", "application/pdf", ""]) {
      expect(await readBrandMark(picked(type), EMBLEM_BOX)).toHaveProperty("problem");
    }
  });

  it("refuses a file over 5 MB before decoding it", async () => {
    const result = await readBrandMark(picked("image/png", 5 * 1024 * 1024 + 1), EMBLEM_BOX);
    expect(result).toEqual({ problem: expect.stringContaining("5 MB") });
  });

  it("draws the image at most 256 px on its longest side and keeps the WebP", async () => {
    const drawn = stubBrowser(2000, 1000, "data:image/webp;base64,AAAA");
    const result = await readBrandMark(picked("image/jpeg"), EMBLEM_BOX);
    expect(result).toEqual({ dataUrl: "data:image/webp;base64,AAAA" });
    expect(drawn).toEqual([{ width: 256, height: 128 }]);
  });

  it("refuses an image still over 200 KB after resizing", async () => {
    stubBrowser(256, 256, `data:image/webp;base64,${"A".repeat(300_000)}`);
    const result = await readBrandMark(picked("image/png"), EMBLEM_BOX);
    expect(result).toEqual({ problem: expect.stringContaining("200 KB") });
  });
});

describe("dataUrlBytes", () => {
  it("counts the decoded bytes, padding included", () => {
    expect(dataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
    expect(dataUrlBytes("data:image/png;base64,AAA=")).toBe(2);
  });
});
