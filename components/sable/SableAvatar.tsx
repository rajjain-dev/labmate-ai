"use client";

import type { VoiceCoachControls } from "@/components/voice/VoiceCoach";
import styles from "./SableAvatar.module.css";

export function SableAvatar({ phase = "idle", awake = false, className = "" }: {
  phase?: VoiceCoachControls["phase"];
  awake?: boolean;
  className?: string;
}) {
  const active = phase !== "idle";
  return <span aria-hidden="true" data-phase={phase} className={`${styles.avatar} ${className}`}>
    <span className={styles.halo} />
    <img src={awake || active ? "/sable/sable-awake.png" : "/sable/sable-sleep.png"} alt="" width={1024} height={1024} className={styles.character} />
    {active && <span className={styles.wave}>{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</span>}
    <span className={styles.sparkle}>✧</span>
  </span>;
}
