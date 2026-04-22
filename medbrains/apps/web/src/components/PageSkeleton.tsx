import { Center } from "@mantine/core";
import styles from "./PageSkeleton.module.scss";

// Two PQRST beats — matching EcgLoader waveform shape
const ECG_POINTS = [
  "0,20", "10,20", "20,20",
  // Beat 1 — P wave
  "26,20", "28,19", "30,18", "31,17.5", "32,18", "33,19", "34,20",
  // PR + QRS
  "36,20", "39,20",
  "40,20.5", "41,21", "41.5,17", "42,4", "42.5,5",
  "43,32", "43.5,34", "44,30", "44.5,24", "45,20",
  // ST + T wave
  "47,20", "52,20",
  "54,20", "56,19", "58,18", "59,17.5", "60,18", "62,19", "64,20",
  // Gap
  "70,20", "100,20",
  // Beat 2 — P wave
  "106,20", "108,19", "110,18", "111,17.5", "112,18", "113,19", "114,20",
  // PR + QRS
  "116,20", "119,20",
  "120,20.5", "121,21", "121.5,17", "122,4", "122.5,5",
  "123,32", "123.5,34", "124,30", "124.5,24", "125,20",
  // ST + T wave
  "127,20", "132,20",
  "134,20", "136,19", "138,18", "139,17.5", "140,18", "142,19", "144,20",
  // Tail
  "150,20", "200,20",
].join(" ");

export function PageSkeleton() {
  return (
    <Center h="100vh" className={styles.wrapper}>
      <div className={styles.container}>
        <svg
          className={styles.ecg}
          viewBox="0 0 200 40"
          fill="none"
        >
          <defs>
            <mask id="pageSkelMask">
              <rect
                className={styles.sweepRect}
                x="0"
                y="0"
                width="0"
                height="40"
                fill="white"
              />
            </mask>
          </defs>
          {/* Dim baseline */}
          <line x1="0" y1="20" x2="200" y2="20" stroke="#34d399" strokeWidth="1" opacity="0.1" />
          {/* Ghost trace */}
          <polyline
            className={styles.shadowLine}
            stroke="#34d399"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={ECG_POINTS}
          />
          {/* Active bright trace */}
          <polyline
            className={styles.mainLine}
            stroke="#34d399"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            mask="url(#pageSkelMask)"
            points={ECG_POINTS}
          />
        </svg>
        <span className={styles.text}>MedBrains</span>
      </div>
    </Center>
  );
}
