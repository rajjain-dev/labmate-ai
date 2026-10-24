"use client";

import { useEffect, useRef, useState } from "react";

export interface SpeechButtonProps {
  speechText: string;
  disabled?: boolean;
  mode?: "disabled" | "fixture" | "live";
}

export function SpeechButton({ speechText, disabled = false, mode = "disabled" }: SpeechButtonProps) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function cleanup() {
    controller.current?.abort(); controller.current = null;
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current.removeAttribute("src"); audio.current.load(); }
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }

  useEffect(() => {
    generation.current++; cleanup(); setBusy(false); setPlaying(false); setError(""); setNotice("");
    return () => { generation.current++; cleanup(); };
  }, [speechText, disabled, mode]);

  function stop() { generation.current++; cleanup(); setBusy(false); setPlaying(false); setNotice(""); }

  async function listen() {
    if (disabled || mode === "disabled" || !consent || !speechText.trim() || speechText.length > 900 || busy || playing) return;
    const token = ++generation.current;
    cleanup(); setError(""); setNotice(""); setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/speech", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: speechText, consent: true }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(16_000)]),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("audio/mpeg")) throw new Error();
      const returnedMode = response.headers.get("X-LabMate-Mode");
      if (!["fixture", "live"].includes(returnedMode ?? "")) throw new Error();
      const blob = await response.blob();
      if (token !== generation.current) return;
      if (!blob.size || blob.size > 2 * 1024 * 1024) throw new Error();
      const objectUrl = URL.createObjectURL(blob); url.current = objectUrl;
      const player = new Audio(objectUrl); audio.current = player;
      const finish = () => { if (token === generation.current) { cleanup(); setPlaying(false); setBusy(false); } };
      player.onended = finish;
      player.onerror = () => { if (token === generation.current) { finish(); setError("Playback failed. Read the visible review."); } };
      setNotice(returnedMode === "fixture" ? "Fixture audio: a sample notice plays instead of your review. Live speech has not been used." : "Reading the latest review summary through ElevenLabs.");
      await player.play();
      if (token !== generation.current) return;
      setBusy(false); setPlaying(true);
    } catch {
      if (token !== generation.current) return;
      cleanup(); setBusy(false); setPlaying(false); setError("Speech is unavailable. Read the visible review.");
    } finally { if (controller.current === abort) controller.current = null; }
  }

  return <section aria-label="Listen to review">
    <label><input type="checkbox" checked={consent} disabled={busy || playing || disabled || mode === "disabled"} onChange={event => setConsent(event.target.checked)} />I consent to sending this summary to ElevenLabs for speech in live mode.</label>
    {mode === "fixture" && <p>Fixture mode plays a sample notice; it does not read your review.</p>}
    {mode === "disabled" && <p>Spoken summaries are unavailable. Read the visible review.</p>}
    <button type="button" disabled={disabled || mode === "disabled" || !consent || !speechText.trim() || speechText.length > 900 || busy || playing} onClick={listen}>Listen to summary</button>
    {(busy || playing) && <button type="button" onClick={stop}>Stop audio</button>}
    <p role="status" aria-live="polite">{busy ? "Preparing audio." : notice}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
