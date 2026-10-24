import { type DotLottie, DotLottieReact, setWasmUrl } from "@lottiefiles/dotlottie-react";
import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";
import chibiUrl from "@medbrains/design-system/assets/mascot/crab-chibi.lottie?url&no-inline";
import geometricUrl from "@medbrains/design-system/assets/mascot/crab-geometric.lottie?url&no-inline";
import lineUrl from "@medbrains/design-system/assets/mascot/crab-line.lottie?url&no-inline";
import medicUrl from "@medbrains/design-system/assets/mascot/crab-medic.lottie?url&no-inline";
import { type ReactNode, useEffect, useState } from "react";
import type { CrabState, CrabVariant } from "./Crab";
import styles from "./crab.module.scss";

// The player's WebAssembly comes from our own origin, never a CDN.
setWasmUrl(wasmUrl);

const SRC: Record<CrabVariant, string> = {
  geometric: geometricUrl,
  line: lineUrl,
  medic: medicUrl,
  chibi: chibiUrl,
};

export interface CrabPlayerProps {
  variant: CrabVariant;
  state: CrabState;
  /** A theme inside the .lottie file: `light`, `dark` or `onBrand`. */
  themeId: string;
  /** Called once the animation runs, so the static art can step aside. */
  onReady: () => void;
}

/**
 * The animated crab (dotLottie, built by apps/web/scripts/build-crab-lottie.mjs).
 * Its state machine follows the `mood` input and plays a reaction on tap.
 * Loaded lazily by `Crab`; while it loads, or if it fails, the static art shows.
 */
export default function CrabPlayer({
  variant,
  state,
  themeId,
  onReady,
}: CrabPlayerProps): ReactNode {
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [started, setStarted] = useState(false);

  // External system: start listening once the player instance exists.
  useEffect(() => {
    if (!player) return;
    const start = () => {
      setStarted(true);
      onReady();
    };
    player.addEventListener("stateMachineStart", start);
    return () => player.removeEventListener("stateMachineStart", start);
  }, [player, onReady]);

  // External system: push the mood into the running state machine.
  useEffect(() => {
    if (started) player?.stateMachineSetStringInput("mood", state);
  }, [player, started, state]);

  // External system: the `themeId` config is not applied once a state machine
  // starts, so set the theme on the running player (and on scheme changes).
  useEffect(() => {
    if (started) player?.setTheme(themeId);
  }, [player, started, themeId]);

  return (
    <DotLottieReact
      className={styles.player}
      src={SRC[variant]}
      stateMachineId="crab"
      themeId={themeId}
      autoplay
      dotLottieRefCallback={setPlayer}
      aria-hidden="true"
    />
  );
}
