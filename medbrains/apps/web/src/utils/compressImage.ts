import imageCompression from "browser-image-compression";

/** Raster photo types that benefit from re-encoding. PDFs/SVGs are left as-is. */
const COMPRESSIBLE = /^image\/(jpe?g|png|webp)$/i;
/** Below this, compression overhead isn't worth it. */
const MIN_BYTES = 512 * 1024;

export interface CompressOptions {
  /** Longest edge after resize. Default 2200px — keeps document scans legible. */
  maxWidthOrHeight?: number;
  /** Soft target size in MB. Default 1.5. */
  maxSizeMB?: number;
}

/**
 * Shrink a raster image before a presigned-S3 upload: resize + re-encode so a
 * 5–10 MB phone photo (wound/document scan) becomes ~1 MB, cutting upload
 * bandwidth and storage 80–90% — a big deal on poor hospital networks.
 *
 * Safe by construction: only JPEG/PNG/WebP are touched (PDFs and other types
 * pass through untouched), tiny files are skipped, and the default 2200px edge
 * preserves document legibility. Never throws — a compression failure returns
 * the original file so an upload is never blocked.
 *
 * Not for diagnostic DICOM imaging, which must stay lossless (separate path).
 */
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) || file.size < MIN_BYTES) {
    return file;
  }
  try {
    const out = await imageCompression(file, {
      maxWidthOrHeight: opts.maxWidthOrHeight ?? 2200,
      maxSizeMB: opts.maxSizeMB ?? 1.5,
      useWebWorker: true,
    });
    // Only adopt the result if it actually got smaller.
    if (out.size >= file.size) {
      return file;
    }
    return new File([out], file.name, {
      type: out.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
