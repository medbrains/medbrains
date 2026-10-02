/**
 * The anatomy model behind the body-site picker: BodyParts3D 4.0 as packaged
 * by github.com/ashemag/human-atlas (MIT code; anatomy data CC BY 4.0 — see
 * `scripts/sync_anatomy_atlas.py` and the attribution shown in the picker).
 *
 * Served from VITE_ANATOMY_BASE_URL (a CDN in production, `/anatomy` in dev),
 * loaded only when the picker opens: ~33 MB gzipped never rides first paint.
 */

export type SystemId =
  | "integumentary"
  | "skeletal"
  | "muscular"
  | "cardiac"
  | "arterial"
  | "venous"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "reproductive"
  | "lymphatic"
  | "endocrine"
  | "connective"
  | "sensory";

/** Body systems in the order a clinician reaches for them; the surface first. */
export const SYSTEMS: ReadonlyArray<{ id: SystemId; label: string }> = [
  { id: "integumentary", label: "Body surface" },
  { id: "skeletal", label: "Skeleton" },
  { id: "muscular", label: "Muscles" },
  { id: "nervous", label: "Nerves" },
  { id: "arterial", label: "Arteries" },
  { id: "venous", label: "Veins" },
  { id: "cardiac", label: "Heart" },
  { id: "respiratory", label: "Respiratory" },
  { id: "digestive", label: "Digestive" },
  { id: "urinary", label: "Urinary" },
  { id: "reproductive", label: "Reproductive" },
  { id: "lymphatic", label: "Lymphatic" },
  { id: "endocrine", label: "Endocrine" },
  { id: "sensory", label: "Sensory organs" },
  { id: "connective", label: "Connective tissue" },
];

/** What a wound or an injury sits on, before looking inside. */
export const DEFAULT_SYSTEMS: SystemId[] = ["skeletal", "muscular"];

export interface AtlasPart {
  id: string;
  name: string;
  /** Foundational Model of Anatomy concept — what the picker stores. */
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface AtlasChunk {
  url: string;
  bytes: number;
  gzip?: string;
  gzipBytes?: number;
}

export interface Atlas {
  version: string;
  parts: AtlasPart[];
  chunks: AtlasChunk[];
}

export type Laterality = "left" | "right" | "bilateral" | "midline";

/** A chosen body site: the words a clinician reads and the code a system reads. */
export interface BodySite {
  label: string;
  /** FMA concept id, or null when typed free-hand (no model, no WebGL). */
  code: string | null;
  laterality: Laterality | null;
}

export const ANATOMY_BASE_URL: string = import.meta.env.VITE_ANATOMY_BASE_URL ?? "/anatomy";

export async function fetchAtlas(signal?: AbortSignal): Promise<Atlas> {
  const response = await fetch(`${ANATOMY_BASE_URL}/atlas.json`, { signal });
  if (!response.ok) throw new Error("The anatomy model could not be loaded.");
  return (await response.json()) as Atlas;
}

/** A chunk's file, relative to the base URL (upstream paths start `/models/`). */
export function chunkUrl(chunk: AtlasChunk): string {
  const path = (chunk.gzip ?? chunk.url).replace(/^\/?models\//, "");
  return `${ANATOMY_BASE_URL}/${path}`;
}

/**
 * Static hosts serve `.gz` either as a compressed response (already decoded by
 * fetch) or as a gzip file; check the magic bytes rather than decode twice.
 */
export async function fetchChunk(chunk: AtlasChunk, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(chunkUrl(chunk), { signal });
  if (!response.ok) throw new Error("An anatomy file could not be loaded.");
  const payload = await response.arrayBuffer();
  const head = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const gzipped = chunk.gzip !== undefined && head[0] === 0x1f && head[1] === 0x8b;
  const buffer = gzipped
    ? await new Response(
        new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer()
    : payload;
  if (buffer.byteLength !== chunk.bytes) {
    throw new Error("An anatomy file was incomplete. Close and reopen the picker.");
  }
  return buffer;
}

/** The side a structure's own name states ("Left femur"), else none. */
export function lateralityFromName(name: string): Laterality | null {
  if (/\bleft\b/i.test(name)) return "left";
  if (/\bright\b/i.test(name)) return "right";
  return null;
}

/** One line a chart can print: "Left femur (left)". */
export function formatBodySite(site: BodySite): string {
  const side = site.laterality && !new RegExp(`\\b${site.laterality}\\b`, "i").test(site.label);
  return side ? `${site.label} (${site.laterality})` : site.label;
}
