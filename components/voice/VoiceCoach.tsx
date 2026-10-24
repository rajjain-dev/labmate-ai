"use client";

import { useEffect, useRef, useState } from "react";
import { TranscribeResponseSchema, type VoiceMode } from "@/lib/contracts";

const QUESTION = "What are you doing, and what would you like help with?";
const MAX_BYTES = 5 * 1024 * 1024;
type Phase = "idle" | "preparing" | "asking" | "listening" | "transcribing" | "thinking" | "reading";
class VoiceFailure extends Error {}

async function responseError(response: Response): Promise<VoiceFailure> {
  const data = await response.json().catch(() => null);
  const message = data?.error?.message;
  return new VoiceFailure(typeof message === "string" && message.length <= 300 ? message : "Voice is unavailable. Please try again or type instead.");
}

async function play(context: AudioContext, bytes: ArrayBuffer, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const buffer = await context.decodeAudioData(bytes.slice(0));
  signal.throwIfAborted();
  if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 120) throw new VoiceFailure("The audio could not be played. Please try again.");
  await new Promise<void>((resolve, reject) => {
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    const cleanup = () => { source.onended = null; signal.removeEventListener("abort", abort); source.disconnect(); };
    const abort = () => { cleanup(); try { source.stop(); } catch {} reject(signal.reason); };
    source.onended = () => { cleanup(); resolve(); };
    signal.addEventListener("abort", abort, { once: true });
    try { signal.throwIfAborted(); source.start(); } catch (error) { cleanup(); reject(error); }
  });
}

/** Audio is captured only after the spoken question ends, and the mic closes before upload. */
function capture(context: AudioContext, stream: MediaStream, signal: AbortSignal, setFinish: (finish: (() => void) | null) => void, waitForSpeech = false): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { reject(new VoiceFailure("Recording is unavailable in this browser. Please type instead.")); return; }
    const recorder = new MediaRecorder(stream, { mimeType });
    const input = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser(); analyser.fftSize = 2048; input.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const chunks: Blob[] = [];
    const started = performance.now();
    let size = 0; let settled = false; let heardSpeech = false; let speechFrames = 0; let lastSpeech = started;
    let poll: ReturnType<typeof setInterval> | undefined;
    let limit: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (poll) clearInterval(poll); if (limit) clearTimeout(limit);
      setFinish(null); signal.removeEventListener("abort", abort);
      recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
      input.disconnect(); analyser.disconnect(); stream.getTracks().forEach(track => track.stop());
    };
    const fail = (error: unknown) => { if (settled) return; settled = true; cleanup(); reject(error); };
    const abort = () => fail(signal.reason);
    const finish = () => { if (!settled && recorder.state === "recording") recorder.stop(); };
    recorder.ondataavailable = event => {
      size += event.data.size;
      if (size > MAX_BYTES) { fail(new VoiceFailure("That recording is too large. Please give a shorter answer.")); return; }
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => fail(new VoiceFailure("Recording failed. Please try again or type instead."));
    recorder.onstop = () => {
      if (settled) return; settled = true;
      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
      cleanup();
      if (waitForSpeech && !heardSpeech) resolve(null);
      else if (audio.size) resolve(audio); else reject(new VoiceFailure("I didn’t hear an answer. Please try again."));
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted(); recorder.start(250); setFinish(finish);
      // RMS endpointing: 150 ms of speech followed by a 2.2-second pause.
      // Web Audio time-domain samples: https://www.w3.org/TR/webaudio/#AnalyserNode
      poll = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0; for (const value of samples) energy += value * value;
        const now = performance.now();
        if (Math.sqrt(energy / samples.length) > 0.008) {
          if (++speechFrames >= 3) heardSpeech = true;
          lastSpeech = now;
        } else speechFrames = 0;
        if (heardSpeech && now - lastSpeech >= 2200) finish();
        else if (!waitForSpeech && !heardSpeech && now - started >= 12_000) fail(new VoiceFailure("I didn’t hear you. Tap the button and try again, or type instead."));
      }, 50);
      limit = setTimeout(finish, 29_000);
    } catch (error) { fail(error); }
  });
}

export interface VoiceCoachProps {
  mode: VoiceMode;
  disabled?: boolean;
  stopSignal?: number;
  continuous?: boolean;
  onBegin?: () => Promise<string | undefined>;
  startLabel?: string;
  onTranscript: (transcript: string) => Promise<string | { text: string; endSession?: boolean } | undefined>;
  onActiveChange: (active: boolean) => void;
  onCancel: () => void;
}

export function VoiceCoach({ mode, disabled = false, stopSignal = 0, continuous = false, onBegin, startLabel = "Talk to LabMate", onTranscript, onActiveChange, onCancel }: VoiceCoachProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const finish = useRef<(() => void) | null>(null);
  const active = phase !== "idle";

  function cleanup() {
    controller.current?.abort(); controller.current = null; finish.current = null;
    microphone.current?.getTracks().forEach(track => track.stop()); microphone.current = null;
    const audio = context.current; context.current = null;
    if (audio && audio.state !== "closed") void audio.close().catch(() => {});
  }
  function cancel() { generation.current++; cleanup(); setPhase("idle"); setError(""); setNotice(""); onCancel(); }
  useEffect(() => { onActiveChange(active); }, [active, onActiveChange]);
  useEffect(() => () => { generation.current++; cleanup(); }, []);
  useEffect(() => { if (mode === "disabled") cancel(); }, [mode]);
  useEffect(() => { if (controller.current) cancel(); }, [stopSignal]);
  useEffect(() => {
    const hide = () => { if (document.hidden && controller.current) cancel(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  async function start() {
    if (active || disabled || mode === "disabled") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      setError("Voice isn’t supported in this browser. You can type instead."); return;
    }
    const token = ++generation.current;
    cleanup(); setError(""); setNotice(""); setPhase("preparing");
    const abort = new AbortController(); controller.current = abort;
    let answered = false;
    try {
      // Unlock audio during the button gesture; no autoplay prompt is needed.
      const audio = new AudioContext(); context.current = audio;
      const resumed = audio.resume();
      void resumed.catch(() => {});
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (token !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      microphone.current = acquired;
      await resumed;

      async function speak(text: string) {
        // Sentence-aware clips stay within the existing 900-character TTS bound.
        const clips: string[] = [];
        let remaining = text.trim();
        while (remaining.length > 850) {
          let cut = remaining.lastIndexOf(". ", 850);
          if (cut >= 300) cut++;
          else { cut = remaining.lastIndexOf(" ", 850); if (cut < 300) cut = 850; }
          clips.push(remaining.slice(0, cut).trim()); remaining = remaining.slice(cut).trimStart();
        }
        if (remaining) clips.push(remaining);
        for (const clip of clips) {
          abort.signal.throwIfAborted(); setPhase("reading");
          const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clip, consent: true }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(16_000)]) });
          if (!response.ok) throw await responseError(response);
          if (response.headers.get("X-LabMate-Mode") !== mode || !response.headers.get("Content-Type")?.includes("audio/mpeg")) throw new VoiceFailure("The spoken answer could not play.");
          const bytes = await response.arrayBuffer();
          if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024) throw new VoiceFailure("The spoken answer could not play.");
          await play(audio, bytes, abort.signal);
        }
      }
      if (onBegin) {
        setPhase("thinking");
        const introduction = await onBegin();
        if (token !== generation.current) return;
        if (introduction) { answered = true; await speak(introduction); }
      } else {
        const response = await fetch("/audio/labmate-intro.mp3", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new VoiceFailure("The voice question could not load. Please try again.");
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024) throw new VoiceFailure("The voice question could not load.");
        setPhase("asking"); await play(audio, bytes, abort.signal);
      }
      do {
        abort.signal.throwIfAborted();
        // Let the speaker's last sound settle before recording.
        await new Promise(resolve => setTimeout(resolve, 180));
        abort.signal.throwIfAborted();
        answered = false;
        let stream = microphone.current;
        if (!stream || !stream.getAudioTracks().some(track => track.readyState === "live")) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
          if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
          microphone.current = stream;
        }
        setPhase("listening");
        const recording = await capture(audio, stream, abort.signal, value => { finish.current = value; }, continuous);
        microphone.current = null;
        if (!recording) continue; // Quiet turns never leave the browser or spend credits.
        answered = false;
        abort.signal.throwIfAborted(); setPhase("transcribing");
        const form = new FormData(); form.set("file", recording, recording.type.startsWith("audio/mp4") ? "answer.mp4" : "answer.webm"); form.set("consent", "true");
        const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(16_000)]) });
        if (!response.ok) throw await responseError(response);
        const parsed = TranscribeResponseSchema.safeParse(await response.json());
        if (!parsed.success || !parsed.data.transcript.trim() || response.headers.get("X-LabMate-Mode") !== mode) throw new VoiceFailure("I couldn’t make out that answer. Please try again.");
        const transcript = parsed.data.transcript.trim();
        if (/^(?:stop(?: listening)?|end(?: the)? conversation|goodbye|bye|that['’]?s all)[.!?]*$/i.test(transcript)) { cancel(); return; }
        abort.signal.throwIfAborted(); setPhase("thinking");
        const speech = await onTranscript(transcript);
        if (token !== generation.current) return;
        answered = true;
        if (!speech) break;
        await speak(typeof speech === "string" ? speech : speech.text);
        if (typeof speech !== "string" && speech.endSession) break;
      } while (continuous && !abort.signal.aborted);

    } catch (failure) {
      if (token !== generation.current) return;
      if (answered) setNotice("Your guidance is ready below. Spoken playback is unavailable.");
      else setError(failure instanceof VoiceFailure ? failure.message
        : failure instanceof Error && failure.name === "NotAllowedError" ? "Allow microphone access in your browser to speak, or type instead."
        : "Voice couldn’t finish. Please try again or type instead.");
    } finally {
      if (token === generation.current) { cleanup(); setPhase("idle"); }
    }
  }

  const status = { idle: "", preparing: "Getting ready…", asking: QUESTION, listening: "Listening… ask your question, then pause.", transcribing: "Got it. Turning your answer into words…", thinking: "Thinking with you…", reading: "Here’s your guidance…" }[phase];
  return <section className={`voice-coach ${active ? "active" : ""}`} aria-label="Talk to LabMate">
    <div className={`voice-orb ${phase}`} aria-hidden="true">⌁</div>
    <h2>{phase === "listening" ? "I’m listening" : "Your lab companion"}</h2>
    <p>{continuous ? "Hear the briefing, then ask questions naturally. I’ll keep listening between answers." : "One tap. Answer the question, then pause. I’ll take it from there."}</p>
    <div className="voice-actions">
      <button type="button" className="primary-button voice-start" disabled={!active && (disabled || mode === "disabled")} onClick={() => active ? cancel() : void start()}>{active ? "End conversation" : startLabel}</button>
    </div>
    <p className="voice-status" role="status" aria-live="polite">{status || notice}</p>
    {mode === "disabled" ? <small>Voice is unavailable right now. Type below.</small> : <small>Voice uses ElevenLabs. Your words go to xAI for guidance.{mode === "fixture" ? " Sample mode returns a canned transcript and answer." : ""}</small>}
    {error && <p className="error-box" role="alert">{error}</p>}
  </section>;
}
