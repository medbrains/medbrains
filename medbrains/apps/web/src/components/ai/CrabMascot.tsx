import styles from "./crab-mascot.module.scss";

// MedBrains brain-crab mascot — one parameterised SVG, ported from the
// design-system spec. Brain-shell body · red medical cross · round eyes ·
// crab claws + legs. The assistant swaps `pose` to match what it's doing.
// (This is a brand illustration component, in the spirit of EcgLoader — not
// a UI icon, so an inline SVG is the intended form.)

export type CrabPose = "greet" | "think" | "analyze" | "diagnose" | "explain";

export interface CrabMascotProps {
  size?: number;
  pose?: CrabPose;
  /** Solid-on-accent treatment (e.g. on a coloured surface). */
  reversed?: boolean;
  animate?: boolean;
  accent?: string;
  accentSoft?: string;
  edgeColor?: string;
  "aria-label"?: string;
}

interface ClawProps {
  x: number;
  y: number;
  rot: number;
  waving: boolean;
  edge: string;
  limb: string;
}

function Claw({ x, y, rot, waving, edge, limb }: ClawProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g
        className={waving ? styles.waver : undefined}
        style={{ transformOrigin: "0px 0px" }}
        stroke={edge}
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
        <path
          d="M2 6 C-22 6 -34 -12 -31 -32 C-28 -50 -10 -60 12 -55 C31 -50 38 -30 32 -14 C27 -1 14 6 2 6 Z"
          fill={limb}
        />
        <path
          d="M-18 -40 C-30 -50 -32 -68 -20 -78 C-8 -74 -2 -60 -5 -47 C-7 -41 -13 -39 -18 -40 Z"
          fill={limb}
        />
        <path
          d="M14 -36 C20 -56 40 -66 54 -58 C57 -43 46 -27 26 -25 C19 -25 15 -30 14 -36 Z"
          fill={limb}
        />
        <circle cx="2" cy="-22" r="4" fill={edge} stroke="none" opacity="0.5" />
      </g>
    </g>
  );
}

export function CrabMascot({
  size = 200,
  pose = "greet",
  reversed = false,
  animate = true,
  accent = "#0f62fe",
  accentSoft = "rgba(15,98,254,.14)",
  edgeColor = "#00182f",
  "aria-label": ariaLabel = "MedBrains assistant",
}: CrabMascotProps) {
  const shell = reversed ? accent : "#ffffff";
  const shellTop = reversed ? "#ffffff" : "#f8f8f7";
  const edge = reversed ? "#ffffff" : edgeColor;
  const gyri = reversed ? "#ffffff" : edgeColor;
  const limb = reversed ? "#ffffff" : accent;
  const blue = reversed ? "#ffffff" : accent;
  const pupil = reversed ? "#ffffff" : edgeColor;
  const cheek = reversed ? "rgba(255,255,255,.28)" : accentSoft;
  const mouthColor = reversed ? "#ffffff" : edgeColor;
  const cross = "#b7322e";

  const look =
    pose === "think"
      ? { dx: 4, dy: -3 }
      : pose === "analyze"
        ? { dx: -3, dy: 2 }
        : { dx: 0, dy: 0 };
  const bobClass = animate ? styles.breathe : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label={ariaLabel}
    >
      <ellipse cx="120" cy="224" rx="74" ry="8" fill="#000" opacity={reversed ? 0.14 : 0.45} />

      {pose === "think" && (
        <g className={animate ? styles.pulse : undefined}>
          <circle
            cx="196"
            cy="52"
            r="15"
            fill={reversed ? "#dbe4f0" : "#20293a"}
            stroke={blue}
            strokeWidth="2"
          />
          <text
            x="196"
            y="58"
            textAnchor="middle"
            fontFamily="IBM Plex Sans, sans-serif"
            fontWeight="700"
            fontSize="18"
            fill={blue}
          >
            ?
          </text>
          <circle
            cx="176"
            cy="72"
            r="5"
            fill={reversed ? "#dbe4f0" : "#20293a"}
            stroke={blue}
            strokeWidth="1.6"
          />
        </g>
      )}
      {pose === "explain" && (
        <g>
          <rect
            x="168"
            y="40"
            width="56"
            height="34"
            rx="12"
            fill={reversed ? "#dbe4f0" : "#20293a"}
            stroke={blue}
            strokeWidth="2"
          />
          <circle cx="184" cy="57" r="3.4" fill={blue} />
          <circle cx="196" cy="57" r="3.4" fill={blue} />
          <circle cx="208" cy="57" r="3.4" fill={blue} />
          <path d="M180 72 L176 84 L190 74 Z" fill={reversed ? "#dbe4f0" : "#20293a"} />
        </g>
      )}

      <g className={bobClass}>
        <g stroke={limb} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M70 172 C56 174 46 178 40 188" />
          <path d="M68 186 C52 190 42 196 38 204" />
          <path d="M72 199 C58 206 52 212 50 220" />
          <path d="M170 172 C184 174 194 178 200 188" />
          <path d="M172 186 C188 190 198 196 202 204" />
          <path d="M168 199 C182 206 188 212 190 220" />
        </g>
        <g fill={limb} stroke={edge} strokeWidth="2">
          <circle cx="40" cy="188" r="4.5" />
          <circle cx="38" cy="204" r="4.5" />
          <circle cx="50" cy="220" r="4.5" />
          <circle cx="200" cy="188" r="4.5" />
          <circle cx="202" cy="204" r="4.5" />
          <circle cx="190" cy="220" r="4.5" />
        </g>

        <path
          d="M74 172 C58 172 48 168 44 160"
          stroke={limb}
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        {pose === "analyze" ? (
          <g transform="translate(30 150)">
            <circle cx="4" cy="-14" r="18" fill="none" stroke={limb} strokeWidth="7" />
            <circle cx="4" cy="-14" r="12" fill={reversed ? "rgba(15,98,254,.18)" : accentSoft} />
            <path d="M16 -2 L30 14" stroke={limb} strokeWidth="9" strokeLinecap="round" />
          </g>
        ) : (
          <Claw
            x={44}
            y={158}
            rot={pose === "greet" ? -66 : pose === "think" ? -44 : -58}
            waving={pose === "greet" && animate}
            edge={edge}
            limb={limb}
          />
        )}

        <path
          d="M166 172 C182 172 192 168 196 160"
          stroke={limb}
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        {pose === "diagnose" ? (
          <g transform="translate(150 108)">
            <rect
              x="0"
              y="0"
              width="52"
              height="66"
              rx="7"
              fill={reversed ? "#f6f8fc" : "#0f1620"}
              stroke={limb}
              strokeWidth="4"
            />
            <rect x="16" y="-8" width="20" height="12" rx="3" fill={limb} />
            <rect x="10" y="14" width="18" height="18" rx="3" fill={blue} />
            <rect x="16" y="19" width="6" height="8" fill="#fff" />
            <rect x="12" y="21.5" width="14" height="3" fill="#fff" />
            <rect
              x="34"
              y="16"
              width="12"
              height="3.4"
              rx="1.7"
              fill={reversed ? "#c3d0e0" : "#2b3644"}
            />
            <rect
              x="10"
              y="40"
              width="34"
              height="3.4"
              rx="1.7"
              fill={reversed ? "#c3d0e0" : "#2b3644"}
            />
            <rect
              x="10"
              y="49"
              width="26"
              height="3.4"
              rx="1.7"
              fill={reversed ? "#c3d0e0" : "#2b3644"}
            />
          </g>
        ) : (
          <g transform="scale(-1,1) translate(-240,0)">
            <Claw x={44} y={158} rot={-58} waving={false} edge={edge} limb={limb} />
          </g>
        )}

        <path
          d="M44 156 C36 122 58 92 92 88 C104 86 104 80 120 80 C136 80 136 86 148 88 C182 92 204 122 196 156 C188 186 150 198 120 198 C90 198 52 186 44 156 Z"
          fill={shell}
          stroke={edge}
          strokeWidth="3"
        />
        <path
          d="M70 108 C90 92 150 92 170 108 C150 100 90 100 70 108 Z"
          fill={shellTop}
          opacity="0.9"
        />
        <g stroke={gyri} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9">
          <path d="M120 84 C120 100 120 108 120 120" />
          <path d="M96 96 C86 104 86 114 94 122" />
          <path d="M144 96 C154 104 154 114 146 122" />
          <path d="M70 120 C80 124 84 132 80 142" />
          <path d="M170 120 C160 124 156 132 160 142" />
        </g>

        {pose === "greet" ? (
          <>
            <path
              d="M95 148 C100 140 112 140 117 148"
              stroke={pupil}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx={136 + look.dx} cy={148 + look.dy} r="8.5" fill={pupil} />
            <circle cx={139 + look.dx} cy={145 + look.dy} r="3" fill="#fff" />
          </>
        ) : (
          <>
            <circle cx={104 + look.dx} cy={148 + look.dy} r="8.5" fill={pupil} />
            <circle cx={136 + look.dx} cy={148 + look.dy} r="8.5" fill={pupil} />
            <circle cx={107 + look.dx} cy={145 + look.dy} r="3" fill="#fff" />
            <circle cx={139 + look.dx} cy={145 + look.dy} r="3" fill="#fff" />
          </>
        )}
        {pose === "analyze" && (
          <>
            <circle cx="136" cy="148" r="14" fill="none" stroke={edge} strokeWidth="3" />
            <path d="M136 162 L140 176" stroke={edge} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        <ellipse cx="88" cy="160" rx="9" ry="5.5" fill={cheek} />
        <ellipse cx="152" cy="160" rx="9" ry="5.5" fill={cheek} />

        {pose === "greet" ? (
          <path
            d="M110 161 C116 171 124 171 130 161 C124 167 116 167 110 161 Z"
            fill={mouthColor}
          />
        ) : pose === "think" ? (
          <path
            d="M114 163 C119 160 126 160 131 163"
            stroke={mouthColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M112 161 C117 168 128 168 133 161"
            stroke={mouthColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        )}

        <g>
          <rect
            x="113"
            y="171"
            width="14"
            height="27"
            rx="4"
            fill={cross}
            stroke={edge}
            strokeWidth="2"
          />
          <rect
            x="106"
            y="178"
            width="28"
            height="13"
            rx="4"
            fill={cross}
            stroke={edge}
            strokeWidth="2"
          />
        </g>
      </g>
    </svg>
  );
}
