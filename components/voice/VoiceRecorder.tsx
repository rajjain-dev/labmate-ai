"use client";

import { useEffect, useId, useRef, useState } from "react";

// Proposed seam for B/A to acknowledge before mounting in A's page.
export interface VoiceRecorderProps {
  onConfirm: (transcript: string) => void;
  disabled?: boolean;
  mode?: "disabled" | "fixture" | "live";
}

type Phase = "idle" | "permission" | "recording" | "transcribing" | "draft";

export function VoiceRecorder({ onConfirm, disabled = false, mode = "disabled" }: VoiceRecorderProps) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [resultMode, setResultMode] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const unavailable = disabled || mode === "disabled";

  function stopResources() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = recorder.current;
    if (current) {
      current.ondataavailable = null;
      current.onstop = null;
      current.onerror = null;
      if (current.state !== "inactive") current.stop();
    }
    recorder.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    controller.current?.abort();
    controller.current = null;
  }

  function cancel() {
    generation.current++;
    stopResources();
    setPhase("idle");
    setTranscript("");
    setConfirmed(false);
    setError("");
  }

  useEffect(() => {
    return () => { generation.current++; stopResources(); };
  }, []);

  useEffect(() => {
    if (unavailable) cancel();
  }, [unavailable, mode]);

  async function startRecording() {
    if (unavailable || !consent || phase === "permission" || phase === "recording" || phase === "transcribing") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is unavailable in this browser. Please type your plan.");
      return;
    }
    const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { setError("This browser has no supported recording format. Please type your plan."); return; }
    const token = ++generation.current;
    stopResources();
    setError(""); setTranscript(""); setConfirmed(false); setResultMode(""); setPhase("permission");
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (token !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const current = new MediaRecorder(acquired, { mimeType });
      recorder.current = current;
      const chunks: Blob[] = [];
      let bytes = 0;
      current.ondataavailable = event => {
        bytes += event.data.size;
        if (bytes > 5 * 1024 * 1024) {
          cancel();
          setError("The recording exceeded 5 MiB. Please make a shorter recording or type your plan.");
          return;
        }
        if (event.data.size) chunks.push(event.data);
      };
      current.onerror = () => {
        if (token !== generation.current) return;
        cancel();
        setError("Recording failed. Please type your plan or try again.");
      };
      current.onstop = async () => {
        if (token !== generation.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        recorder.current = null;
        acquired.getTracks().forEach(track => track.stop());
        stream.current = null;
        setPhase("transcribing");
        const abort = new AbortController();
        controller.current = abort;
        try {
          const form = new FormData();
          form.set("file", new Blob(chunks, { type: mimeType }), mimeType.startsWith("audio/mp4") ? "recording.mp4" : "recording.webm");
          form.set("consent", "true");
          const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(16_000)]) });
          if (!response.ok) throw new Error("Transcription is unavailable. Please type your plan or try another browser.");
          const data = await response.json();
          const returnedMode = response.headers.get("X-LabMate-Mode");
          if (data.requiresConfirmation !== true || typeof data.transcript !== "string" || !data.transcript.trim() || data.transcript.length > 5000 || !["fixture", "live"].includes(returnedMode ?? "")) {
            throw new Error("The transcript could not be read. Please type your plan.");
          }
          if (token !== generation.current) return;
          setTranscript(data.transcript); setResultMode(returnedMode!); setConfirmed(false); setPhase("draft");
        } catch {
          if (token !== generation.current) return;
          setError("Transcription is unavailable. Please type your plan or try another browser."); setPhase("idle");
        } finally { if (controller.current === abort) controller.current = null; }
      };
      current.start(250);
      setPhase("recording");
      // Leave room for encoder padding; the server independently validates duration.
      timer.current = setTimeout(() => { if (current.state === "recording") current.stop(); }, 29_000);
    } catch {
      if (token !== generation.current) return;
      stopResources();
      setError("Microphone access is unavailable. You can still type your plan."); setPhase("idle");
    }
  }

  const busy = phase === "permission" || phase === "recording" || phase === "transcribing";
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Describe your plan by voice</h2>
      <p>Record up to 30 seconds. Text entry remains available.</p>
      {mode === "fixture" && <p>Fixture mode: this returns a labeled sample transcript, without live transcription.</p>}
      {mode === "disabled" && <p>Voice is unavailable. Please type your plan.</p>}
      <label><input type="checkbox" checked={consent} disabled={busy || unavailable} onChange={event => setConsent(event.target.checked)} />
        I consent to sending this recording to ElevenLabs for transcription in live mode. Provider retention depends on the account settings.
      </label>
      <div>
        <button type="button" disabled={unavailable || !consent || busy} onClick={startRecording}>Record plan</button>
        {phase === "recording" && <button type="button" onClick={() => recorder.current?.stop()}>Stop recording</button>}
        {(busy || phase === "draft") && <button type="button" onClick={cancel}>Cancel voice input</button>}
      </div>
      <p role="status" aria-live="polite">{phase === "permission" ? "Waiting for microphone permission." : phase === "recording" ? "Recording. It will stop automatically." : phase === "transcribing" ? "Transcribing. You can cancel." : phase === "draft" ? "Draft transcript ready. Check it before use." : ""}</p>
      {error && <p role="alert">{error}</p>}
      {phase === "draft" && <div>
        {resultMode === "fixture" && <p>Fixture transcript: this is sample text, not recognition of your recording.</p>}
        <label htmlFor={`${id}-transcript`}>Edit transcript</label>
        <textarea id={`${id}-transcript`} value={transcript} maxLength={5000} onChange={event => { setTranscript(event.target.value); setConfirmed(false); }} />
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked chemical names, quantities, units, and negation.</label>
        <button type="button" disabled={unavailable || !confirmed || !transcript.trim()} onClick={() => { onConfirm(transcript.trim()); cancel(); }}>Use confirmed transcript</button>
        <p>This fills the plan draft. Review requires a separate submission.</p>
      </div>}
    </section>
  );
}
