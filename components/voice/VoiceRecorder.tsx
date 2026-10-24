"use client";

import { VoiceCoach } from "./VoiceCoach";
import type { VoiceRecorderProps } from "@/lib/contracts";

export type { VoiceRecorderProps } from "@/lib/contracts";

/** Compatibility adapter. The legacy callback name now receives speech automatically. */
export function VoiceRecorder({ onConfirm, disabled = false, mode = "disabled" }: VoiceRecorderProps) {
  return <VoiceCoach mode={mode} disabled={disabled} onTranscript={async transcript => {
    onConfirm(transcript);
    return undefined;
  }} onActiveChange={() => {}} onCancel={() => {}} />;
}
