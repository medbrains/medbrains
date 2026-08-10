/**
 * File-backed local cache for Camp Mode.
 *
 * SecureStore remains the place for JWTs, device credentials and the
 * per-camp AES key. Large clinical packets are encrypted before they
 * are persisted as files so they survive app restarts and airplane mode
 * without leaving patient data readable through the app sandbox.
 */

import type { CampPacketResponse, CampSyncInboundEvent } from "@medbrains/types";
import { gcm } from "@noble/ciphers/aes";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { apiConfig } from "../api/config.js";
import { type CampDataState, campDataState } from "./readability.js";

const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}medbrains-camp/`;
const PACKET_PREFIX = "packet-";
const OUTBOX_PREFIX = "outbox-";
const META_PREFIX = "medbrains.camp.packet.meta.";
const KEY_PREFIX = "medbrains.camp.packet.aes_key.";
const ACTIVE_CAMP_KEY = "medbrains.camp.active_camp_id";

interface EncryptedCampEnvelope {
  version: 1;
  algorithm: "AES-GCM";
  camp_id: string;
  kind: "packet" | "outbox";
  label: string;
  created_at: string;
  iv_b64: string;
  ciphertext_b64: string;
}

export interface CampPacketMeta {
  campId: string;
  campName: string;
  packetRevision: string;
  downloadedAt: string;
  expiresAt: string;
  registrationCount: number;
  patientCount: number;
  pendingEvents: number;
  expired: boolean;
}

export interface StoredCampEvent extends CampSyncInboundEvent {
  local_status: "queued" | "syncing" | "failed";
  queued_at: string;
  last_error?: string;
}

export async function saveCampPacket(packet: CampPacketResponse): Promise<CampPacketMeta> {
  await ensureCacheDir();
  const keyBytes = await getOrCreatePacketKeyBytes(packet.camp.id);
  const encrypted = encryptJson(packet, keyBytes, {
    campId: packet.camp.id,
    kind: "packet",
    label: packet.packet_revision,
  });
  const path = packetPath(packet.camp.id);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(encrypted));
  const outbox = await readCampOutbox(packet.camp.id);
  const meta: CampPacketMeta = {
    campId: packet.camp.id,
    campName: packet.camp.name,
    packetRevision: packet.packet_revision,
    downloadedAt: packet.downloaded_at,
    expiresAt: packet.expires_at,
    registrationCount: packet.registrations.length,
    patientCount: packet.patient_summaries.length,
    pendingEvents: outbox.length,
    expired: isExpired(packet.expires_at),
  };
  await apiConfig.store.setItem(metaKey(packet.camp.id), JSON.stringify(meta), {
    keychainAccessible: "whenUnlockedThisDeviceOnly",
  });
  await apiConfig.store.setItem(ACTIVE_CAMP_KEY, packet.camp.id, {
    keychainAccessible: "whenUnlockedThisDeviceOnly",
  });
  return meta;
}

export async function loadActiveCampPacket(): Promise<CampPacketResponse | null> {
  const campId = await apiConfig.store.getItem(ACTIVE_CAMP_KEY);
  if (!campId) {
    return null;
  }
  const packet = await loadCampPacket(campId);
  if (!packet) {
    await apiConfig.store.deleteItem(ACTIVE_CAMP_KEY);
  }
  return packet;
}

export async function loadCampPacket(campId: string): Promise<CampPacketResponse | null> {
  await ensureCacheDir();
  const info = await FileSystem.getInfoAsync(packetPath(campId));
  if (!info.exists) {
    return null;
  }
  const text = await FileSystem.readAsStringAsync(packetPath(campId));
  const envelope = JSON.parse(text) as unknown;
  if (!isEncryptedCampEnvelope(envelope) || envelope.kind !== "packet") {
    return null;
  }
  const keyBytes = await getPacketKeyBytes(campId);
  if (!keyBytes) {
    // Same rule as the outbox: leave it, report it, delete only on request.
    return null;
  }
  const packet = decryptJson<CampPacketResponse>(envelope, keyBytes);
  if (isExpired(packet.expires_at)) {
    const outbox = await readCampOutbox(campId);
    if (outbox.length > 0) {
      return null;
    }
    await wipeCampPacket(campId);
    return null;
  }
  return packet;
}

export async function listCampPacketMeta(campIds: string[]): Promise<CampPacketMeta[]> {
  const metas = await Promise.all(campIds.map((campId) => loadCampPacketMeta(campId)));
  return metas.filter((meta): meta is CampPacketMeta => meta !== null);
}

export async function loadCampPacketMeta(campId: string): Promise<CampPacketMeta | null> {
  const raw = await apiConfig.store.getItem(metaKey(campId));
  if (!raw) {
    return null;
  }
  const meta = JSON.parse(raw) as CampPacketMeta;
  const outbox = await readCampOutbox(campId);
  return { ...meta, pendingEvents: outbox.length, expired: isExpired(meta.expiresAt) };
}

export async function wipeCampPacket(campId: string): Promise<void> {
  await apiConfig.store.deleteItem(packetKey(campId));
  await deleteFileIfExists(packetPath(campId));
  await deleteFileIfExists(outboxPath(campId));
  await apiConfig.store.deleteItem(metaKey(campId));
  const activeCampId = await apiConfig.store.getItem(ACTIVE_CAMP_KEY);
  if (activeCampId === campId) {
    await apiConfig.store.deleteItem(ACTIVE_CAMP_KEY);
  }
}

export async function wipeActiveCampPacket(): Promise<void> {
  const activeCampId = await apiConfig.store.getItem(ACTIVE_CAMP_KEY);
  if (!activeCampId) {
    return;
  }
  await wipeCampPacket(activeCampId);
}

export async function queueCampEvent(
  campId: string,
  event: CampSyncInboundEvent,
): Promise<StoredCampEvent[]> {
  const existing = await readCampOutbox(campId);
  if (existing.some((queued) => queued.idempotency_key === event.idempotency_key)) {
    return existing;
  }
  const next: StoredCampEvent[] = [
    ...existing,
    {
      ...event,
      local_status: "queued",
      queued_at: new Date().toISOString(),
    },
  ];
  await writeCampOutbox(campId, next);
  await refreshMetaPendingCount(campId, next.length);
  return next;
}

export async function readCampOutbox(campId: string): Promise<StoredCampEvent[]> {
  await ensureCacheDir();
  const path = outboxPath(campId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return [];
  }
  const text = await FileSystem.readAsStringAsync(path);
  const envelope = JSON.parse(text) as unknown;
  // A read never deletes. If this file cannot be opened it still holds the only
  // evidence that a day's registrations existed, and discarding it here — on a
  // path nobody reviews as a write — is how that disappears silently. Use
  // `campOutboxState` to find out, and `wipeCampPacket` to remove on purpose.
  if (!isEncryptedCampEnvelope(envelope) || envelope.kind !== "outbox") {
    return [];
  }
  const keyBytes = await getPacketKeyBytes(campId);
  if (!keyBytes) {
    return [];
  }
  return decryptJson<StoredCampEvent[]>(envelope, keyBytes);
}

export async function markCampEventsFailed(
  campId: string,
  message: string,
): Promise<StoredCampEvent[]> {
  const existing = await readCampOutbox(campId);
  const next = existing.map((event) => ({
    ...event,
    local_status: "failed" as const,
    last_error: message,
  }));
  await writeCampOutbox(campId, next);
  return next;
}

export async function removeSyncedCampEvents(
  campId: string,
  idempotencyKeys: string[],
): Promise<StoredCampEvent[]> {
  const synced = new Set(idempotencyKeys);
  const next = (await readCampOutbox(campId)).filter((event) => !synced.has(event.idempotency_key));
  await writeCampOutbox(campId, next);
  await refreshMetaPendingCount(campId, next.length);
  return next;
}

async function writeCampOutbox(campId: string, events: StoredCampEvent[]): Promise<void> {
  await ensureCacheDir();
  const keyBytes = await getOrCreatePacketKeyBytes(campId);
  const encrypted = encryptJson(events, keyBytes, {
    campId,
    kind: "outbox",
    label: `outbox:${events.length}`,
  });
  await FileSystem.writeAsStringAsync(outboxPath(campId), JSON.stringify(encrypted));
}

async function refreshMetaPendingCount(campId: string, pendingEvents: number): Promise<void> {
  const raw = await apiConfig.store.getItem(metaKey(campId));
  if (!raw) {
    return;
  }
  const meta = JSON.parse(raw) as CampPacketMeta;
  await apiConfig.store.setItem(metaKey(campId), JSON.stringify({ ...meta, pendingEvents }), {
    keychainAccessible: "whenUnlockedThisDeviceOnly",
  });
}

async function getOrCreatePacketKeyBytes(campId: string): Promise<Uint8Array> {
  const existing = await getPacketKeyBytes(campId);
  if (existing) {
    return existing;
  }
  const keyBytes = secureRandomBytes(32);
  await apiConfig.store.setItem(packetKey(campId), bytesToBase64(keyBytes), {
    keychainAccessible: "whenUnlockedThisDeviceOnly",
    requireAuthentication: false,
  });
  return keyBytes;
}

async function getPacketKeyBytes(campId: string): Promise<Uint8Array | null> {
  const existing = await apiConfig.store.getItem(packetKey(campId));
  if (!existing) {
    return null;
  }
  return base64ToBytes(existing);
}

function encryptJson(
  value: unknown,
  keyBytes: Uint8Array,
  meta: { campId: string; kind: EncryptedCampEnvelope["kind"]; label: string },
): EncryptedCampEnvelope {
  const iv = secureRandomBytes(12);
  const cipher = gcm(keyBytes, iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = cipher.encrypt(plaintext);
  return {
    version: 1,
    algorithm: "AES-GCM",
    camp_id: meta.campId,
    kind: meta.kind,
    label: meta.label,
    created_at: new Date().toISOString(),
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(ciphertext),
  };
}

function decryptJson<T>(envelope: EncryptedCampEnvelope, keyBytes: Uint8Array): T {
  const cipher = gcm(keyBytes, base64ToBytes(envelope.iv_b64));
  const plaintext = cipher.decrypt(base64ToBytes(envelope.ciphertext_b64));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

function isEncryptedCampEnvelope(value: unknown): value is EncryptedCampEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<EncryptedCampEnvelope>;
  return (
    candidate.version === 1 &&
    candidate.algorithm === "AES-GCM" &&
    typeof candidate.camp_id === "string" &&
    (candidate.kind === "packet" || candidate.kind === "outbox") &&
    typeof candidate.iv_b64 === "string" &&
    typeof candidate.ciphertext_b64 === "string"
  );
}

function secureRandomBytes(length: number): Uint8Array {
  return Crypto.getRandomBytes(length);
}

function bytesToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  const buffer = (globalThis as { Buffer?: { from: (value: string, enc: string) => unknown } })
    .Buffer;
  if (buffer?.from) {
    return String(
      (buffer.from(binary, "binary") as { toString: (enc: string) => string }).toString("base64"),
    );
  }
  throw new Error("Base64 encoder is unavailable on this build");
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }
  const buffer = (
    globalThis as {
      Buffer?: { from: (value: string, enc: string) => { values: () => Iterable<number> } };
    }
  ).Buffer;
  if (buffer?.from) {
    return Uint8Array.from(buffer.from(value, "base64").values());
  }
  throw new Error("Base64 decoder is unavailable on this build");
}

async function ensureCacheDir(): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error("Device file storage is unavailable");
  }
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function deleteFileIfExists(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}

function packetPath(campId: string): string {
  return `${CACHE_DIR}${PACKET_PREFIX}${safeFileName(campId)}.json`;
}

function outboxPath(campId: string): string {
  return `${CACHE_DIR}${OUTBOX_PREFIX}${safeFileName(campId)}.json`;
}

function metaKey(campId: string): string {
  return `${META_PREFIX}${campId}`;
}

function packetKey(campId: string): string {
  return `${KEY_PREFIX}${campId}`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isExpired(value: string): boolean {
  return new Date(value).getTime() < Date.now();
}

/**
 * Whether this camp's stored data can still be opened.
 *
 * Exists because an unreadable outbox and an empty one look identical to every
 * other read path — and after a lost key, "empty" is what a volunteer sees
 * having registered forty patients that morning.
 */
export async function campOutboxState(campId: string): Promise<CampDataState> {
  await ensureCacheDir();
  const path = outboxPath(campId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return "absent";
  }
  let envelopeValid = false;
  try {
    const envelope = JSON.parse(await FileSystem.readAsStringAsync(path)) as unknown;
    envelopeValid = isEncryptedCampEnvelope(envelope) && envelope.kind === "outbox";
  } catch {
    envelopeValid = false;
  }
  const keyBytes = await getPacketKeyBytes(campId);
  return campDataState({ fileExists: true, envelopeValid, keyPresent: Boolean(keyBytes) });
}
