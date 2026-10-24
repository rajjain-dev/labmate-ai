"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { type HealthResponse } from "@/lib/contracts";
import { LabDocumentSchema, ConversationReplySchema, type LabDocument, type ConversationReply, type ConversationTurn } from "@/lib/lab/contracts";
import { VoiceCoach } from "@/components/voice/VoiceCoach";
import "./globals.css";

type Message = { id: string; role: "user"; text: string } | { id: string; role: "assistant"; reply: ConversationReply; opening: boolean };
const emergencyCopy = "This app cannot assess an emergency. Alert your lab supervisor or TA now and follow the lab's posted emergency procedures. Contact local emergency services when immediate help is needed.";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lab, setLab] = useState<LabDocument | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [stopSignal, setStopSignal] = useState(0);
  const [sourcePage, setSourcePage] = useState<number | null>(null);
  const [emergency, setEmergency] = useState(false);
  const request = useRef<AbortController | null>(null);
  const upload = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const history = useRef<ConversationTurn[]>([]);
  const briefed = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const mode = health?.appMode ?? "fixture";
  const voiceMode = health?.capabilities.voice ? mode : "disabled";

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: abort.signal }).then(response => response.ok ? response.json() : null).then(data => { if (data) setHealth(data); }).catch(() => {});
    return () => { abort.abort(); request.current?.abort(); upload.current?.abort(); };
  }, []);

  function cancelPending() { sequence.current++; request.current?.abort(); setThinking(false); }
  async function uploadLab(file: File) {
    if (voiceActive) return;
    if (file.size > 5 * 1024 * 1024) { setError("Use a PDF smaller than 5 MiB."); return; }
    cancelPending(); upload.current?.abort();
    const abort = new AbortController(); upload.current = abort;
    setUploading(true); setError(""); setLab(null); setMessages([]); setQuestion(""); history.current = []; briefed.current = false;
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/lab", { method: "POST", body: form, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(17_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "The PDF could not be read.");
      const parsed = LabDocumentSchema.safeParse(data.document);
      if (!parsed.success) throw new Error("The PDF text could not be read.");
      if (upload.current === abort) setLab(parsed.data);
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "The PDF could not be read."); }
    finally { if (upload.current === abort) { upload.current = null; setUploading(false); } }
  }

  async function ask(message: string, opening = false): Promise<ConversationReply | undefined> {
    if (!lab) return;
    cancelPending(); setError("");
    const token = ++sequence.current;
    const abort = new AbortController(); request.current = abort; setThinking(true);
    if (message) setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", text: message }]);
    try {
      const response = await fetch("/api/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lab, opening, message, history: history.current.slice(-12) }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(27_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "I couldn’t answer that. Please try again.");
      const parsed = ConversationReplySchema.safeParse(data);
      if (!parsed.success) throw new Error("I couldn’t read that answer. Please ask again.");
      if (token !== sequence.current) return;
      const reply = parsed.data;
      const context = [reply.answer, ...reply.precautions.map(item => item.quote)].join("\n").slice(0, 2500);
      history.current = [...history.current, ...(message ? [{ role: "user" as const, content: message.slice(0, 2500) }] : []), { role: "assistant", content: context }].slice(-12) as ConversationTurn[];
      if (opening) briefed.current = true;
      setMessages(previous => [...previous, { id: reply.requestId, role: "assistant", reply, opening }]);
      return reply;
    } catch (failure) { if (token === sequence.current) setError(failure instanceof Error ? failure.message : "I couldn’t answer that. Please try again."); }
    finally { if (token === sequence.current) setThinking(false); }
  }
  function spoken(reply: ConversationReply, opening = false): string {
    return [reply.mode === "fixture" ? "Sample mode. " : "", reply.answer, ...(reply.precautions.length ? ["The handout lists these precautions.", ...reply.precautions.map(item => item.quote)] : []), opening ? "What would you like to ask?" : ""].filter(Boolean).join(" ");
  }
  async function typeQuestion(event: FormEvent) { event.preventDefault(); if (!question.trim() || thinking || voiceActive) return; const message = question.trim(); setQuestion(""); await ask(message); }
  const page = lab?.pages.find(item => item.number === sourcePage);

  return <div className="workspace conversational">
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon">L<span>•</span></span>LabMate <small>AI</small></a><div className="top-meta"><i className={mode} />{health ? mode === "live" ? "Live voice" : "Sample mode" : "Connecting…"}</div></header>
    <main>
      <section className="intro"><div><p className="eyebrow">YOUR LAB, IN CONVERSATION</p><h1>Bring your handout.<br /><span>We’ll talk it through.</span></h1><p className="intro-copy">A brief, the handout’s precautions, and a companion for your questions.</p></div></section>
      <div className="conversation-layout">
        <section className="conversation-controls">
          <div className="upload-card" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !voiceActive && !uploading) void uploadLab(file); }}>
            <span className="upload-icon" aria-hidden="true">↥</span><h2>{uploading ? "Reading your handout…" : lab ? lab.title : "Upload your lab experiment"}</h2>
            <p>{lab ? `${lab.pages.length} ${lab.pages.length === 1 ? "page" : "pages"} ready. Start the conversation when you’re ready.` : "Drop a PDF here, or choose your handout."}</p>
            <input ref={fileInput} className="file-input" type="file" accept="application/pdf,.pdf" disabled={voiceActive || uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadLab(file); event.target.value = ""; }} />
            <button type="button" className="secondary-button" disabled={voiceActive || uploading} onClick={() => fileInput.current?.click()}>{uploading ? "Reading PDF…" : lab ? "Change PDF" : "Choose PDF"}</button>
            {!lab && <small>Selectable text · up to 25 pages · 5 MiB</small>}
          </div>
          <VoiceCoach mode={voiceMode} disabled={!lab || uploading || thinking} stopSignal={stopSignal} continuous startLabel={briefed.current ? "Resume conversation" : "Start conversation"} onActiveChange={setVoiceActive} onCancel={cancelPending} onBegin={async () => {
            if (briefed.current) return undefined;
            const reply = await ask("", true);
            if (!reply) throw new Error("The briefing could not be prepared.");
            return spoken(reply, true);
          }} onTranscript={async transcript => {
            const reply = await ask(transcript);
            return reply ? { text: spoken(reply), endSession: reply.emergency } : undefined;
          }} />
          {error && <p className="error-box" role="alert">{error}</p>}
          <details className="type-instead"><summary>Type instead</summary><form onSubmit={typeQuestion}><label htmlFor="question" className="sr-only">Your question</label><textarea id="question" value={question} maxLength={5000} rows={3} disabled={!lab || thinking || voiceActive} placeholder={voiceActive ? "End the voice conversation to type." : "Ask about your experiment…"} onChange={event => setQuestion(event.target.value)} /><button className="primary-button" disabled={!lab || !question.trim() || thinking || voiceActive}>Send →</button></form></details>
          <p className="privacy-note">Your PDF text and questions go to xAI. Voice uses ElevenLabs. This page keeps the conversation in memory.</p>
        </section>
        <section className="conversation-messages" aria-label="Conversation">
          {!messages.length && !thinking ? <div className="conversation-empty"><span aria-hidden="true">✧</span><h2>From the first overview<br />to your next question.</h2><p>Upload your handout and start. LabMate will speak first, then listen for your questions. No confirmations or checkboxes.</p></div> : messages.map(item => item.role === "user" ? <article className="chat-message student" key={item.id}><small>YOU</small><p>{item.text}</p></article> : <article className="chat-message assistant" key={item.id}><small>{item.reply.mode === "fixture" ? "SAMPLE RESPONSE" : item.opening ? "YOUR LAB BRIEF" : "LABMATE"}</small><p>{item.reply.answer}</p>{item.reply.precautions.length > 0 && <div className="handout-precautions"><h3>Precautions from your handout</h3><ul>{item.reply.precautions.map((precaution, index) => <li key={index}>{precaution.quote} <button type="button" className="page-link" onClick={() => setSourcePage(precaution.page)}>p. {precaution.page}</button></li>)}</ul></div>}{item.reply.citations.length > 0 && <div className="page-links">From your handout: {item.reply.citations.map(number => <button type="button" className="page-link" key={number} onClick={() => setSourcePage(number)}>p. {number}</button>)}</div>}</article>)}
          {thinking && <p className="thinking-message" role="status">{messages.length ? "LabMate is thinking…" : "Preparing your brief and the handout’s precautions…"}</p>}
          <p className="sr-only" aria-live="polite">{thinking ? "Preparing an answer" : messages.length ? "Answer ready" : "Upload a handout to begin"}</p>
        </section>
      </div>
      <footer><span>Your course protocol and lab supervisor remain authoritative.</span><button type="button" onClick={() => { setStopSignal(value => value + 1); cancelPending(); setEmergency(true); }}>Possible emergency? Get guidance ↗</button></footer>
    </main>
    {(page || emergency) && <div className="modal-backdrop" onClick={() => { setSourcePage(null); setEmergency(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={emergency ? "Emergency guidance" : "Handout page"} onClick={event => event.stopPropagation()}><button type="button" className="modal-close" autoFocus onClick={() => { setSourcePage(null); setEmergency(false); }}>Close ×</button>{emergency ? <><h2>Contact your lab supervisor.</h2><p>{emergencyCopy}</p></> : page && <><h2>{lab?.title}</h2><p>Page {page.number} · extracted PDF text</p><div className="handout-page">{page.text}</div></>}</section></div>}
  </div>;
}
