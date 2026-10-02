/**
 * The 3D body: one merged mesh per body system, a tap picks a structure.
 *
 * Ported from human-atlas (MIT) and cut down to what a site picker needs — no
 * exploded view, no idle animation. It renders on demand (on orbit, on a
 * change), never in a loop, and disposes every GPU resource, fetch and
 * listener on unmount. Colours come from `--mb-anatomy-*` theme tokens.
 */
import { Box } from "@mantine/core";
import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type Atlas, type AtlasPart, fetchChunk, type SystemId } from "./anatomy-atlas";
import classes from "./body-site.module.scss";

export interface AnatomySceneProps {
  atlas: Atlas;
  visible: SystemId[];
  selectedPartId: string | null;
  onPick: (part: AtlasPart) => void;
  onProgress: (percent: number) => void;
  onError: (message: string) => void;
}

/** Parallel chunk downloads — enough to fill the pipe, few enough for a clinic's link. */
const PARALLEL_CHUNKS = 3;
/** Room around the body when framed: 1 = head and feet touch the edges. */
const FRAME_MARGIN = 1.12;
/** Pixels a pointer may drift and still count as a tap, not an orbit. */
const TAP_SLOP = 6;

interface Stage {
  render: () => void;
  systemMeshes: Map<SystemId, T.Mesh[]>;
  pickers: Map<string, T.Mesh>;
  highlight: T.Mesh;
  empty: T.BufferGeometry;
}

function themeColor(el: HTMLElement, token: string): T.Color {
  const value = getComputedStyle(el).getPropertyValue(token).trim();
  return new T.Color(value || getComputedStyle(el).color);
}

export function AnatomyScene({
  atlas,
  visible,
  selectedPartId,
  onPick,
  onProgress,
  onError,
}: AnatomySceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const callbacks = useRef({ onPick, onProgress, onError });
  callbacks.current = { onPick, onProgress, onError };
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
    } catch {
      callbacks.current.onError("This browser cannot show the 3D body. Type the site instead.");
      return;
    }
    const abort = new AbortController();
    const disposables: Array<{ dispose: () => void }> = [renderer];
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(themeColor(el, "--mb-bg-subtle"));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.01, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    // Frame the whole body from the model's own extent, with a margin.
    const body = new T.Box3();
    for (const part of atlas.parts) {
      body.expandByPoint(new T.Vector3().fromArray(part.bounds[0]));
      body.expandByPoint(new T.Vector3().fromArray(part.bounds[1]));
    }
    const center = body.getCenter(new T.Vector3());
    const height = body.getSize(new T.Vector3()).y;
    const distance = (height / 2 / Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * FRAME_MARGIN;
    controls.target.copy(center);
    camera.position.set(center.x, center.y, center.z + distance);
    scene.add(new T.HemisphereLight(0xffffff, 0x888888, 1.4));
    const key = new T.DirectionalLight(0xffffff, 1.6);
    key.position.set(-2, 4, 3);
    scene.add(key);

    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    const resize = () => {
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const highlightMaterial = new T.MeshStandardMaterial({
      color: themeColor(el, "--mb-anatomy-selected"),
      emissive: themeColor(el, "--mb-anatomy-selected"),
      emissiveIntensity: 0.35,
      depthTest: false,
    });
    const empty = new T.BufferGeometry();
    const highlight = new T.Mesh(empty, highlightMaterial);
    highlight.renderOrder = 10;
    highlight.visible = false;
    scene.add(highlight);
    disposables.push(highlightMaterial, empty);

    const systemMeshes = new Map<SystemId, T.Mesh[]>();
    const pickers = new Map<string, T.Mesh>();
    stage.current = { render, systemMeshes, pickers, highlight, empty };

    const addChunk = (index: number, buffer: ArrayBuffer) => {
      const bySystem = new Map<SystemId, T.BufferGeometry[]>();
      for (const part of atlas.parts) {
        if (part.chunk !== index) continue;
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3),
        );
        g.setAttribute(
          "normal",
          new T.BufferAttribute(
            new Int16Array(buffer, part.normals, part.vertexCount * 3),
            3,
            true,
          ),
        );
        g.setIndex(
          new T.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1),
        );
        g.computeBoundingSphere();
        pickers.set(part.id, new T.Mesh(g));
        disposables.push(g);
        bySystem.set(part.system, [...(bySystem.get(part.system) ?? []), g]);
      }
      for (const [system, geometries] of bySystem) {
        const merged = mergeGeometries(geometries, false);
        if (!merged) continue;
        const material = new T.MeshStandardMaterial({
          color: themeColor(el, `--mb-anatomy-${system}`),
          roughness: 0.55,
          side: T.DoubleSide,
          transparent: system === "integumentary",
          opacity: system === "integumentary" ? 0.18 : 1,
        });
        const mesh = new T.Mesh(merged, material);
        mesh.visible = visibleRef.current.includes(system);
        scene.add(mesh);
        disposables.push(merged, material);
        systemMeshes.set(system, [...(systemMeshes.get(system) ?? []), mesh]);
      }
      render();
    };

    let next = 0;
    let loaded = 0;
    const worker = async () => {
      while (next < atlas.chunks.length) {
        const index = next++;
        const chunk = atlas.chunks[index];
        if (!chunk) return;
        addChunk(index, await fetchChunk(chunk, abort.signal));
        loaded += 1;
        callbacks.current.onProgress(Math.round((loaded / atlas.chunks.length) * 100));
      }
    };
    Promise.all(Array.from({ length: PARALLEL_CHUNKS }, worker)).catch((e: unknown) => {
      if (!abort.signal.aborted) {
        callbacks.current.onError(e instanceof Error ? e.message : "The body could not be loaded.");
      }
    });

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > TAP_SLOP) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const shown = new Set(visibleRef.current);
      const solidShown = [...shown].some((s) => s !== "integumentary");
      let best: { part: AtlasPart; distance: number } | null = null;
      for (const part of atlas.parts) {
        if (!shown.has(part.system) || (solidShown && part.system === "integumentary")) continue;
        const mesh = pickers.get(part.id);
        const hit = mesh ? raycaster.intersectObject(mesh, false)[0] : undefined;
        if (hit && (!best || hit.distance < best.distance)) best = { part, distance: hit.distance };
      }
      if (best) callbacks.current.onPick(best.part);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      abort.abort();
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      for (const d of disposables) d.dispose();
      renderer.domElement.remove();
      stage.current = null;
    };
  }, [atlas]);

  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    for (const [system, meshes] of s.systemMeshes) {
      for (const mesh of meshes) mesh.visible = visible.includes(system);
    }
    s.render();
  }, [visible]);

  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    const picked = selectedPartId ? s.pickers.get(selectedPartId) : undefined;
    s.highlight.geometry = picked?.geometry ?? s.empty;
    s.highlight.visible = Boolean(picked);
    s.render();
  }, [selectedPartId]);

  return <Box ref={host} className={classes.scene} />;
}
