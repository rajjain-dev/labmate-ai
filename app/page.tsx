"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ReviewRequestSchema, ReviewResponseSchema, type ReviewResponse, type HealthResponse, type SourcePassage } from "@/lib/contracts";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { SpeechButton } from "@/components/voice/SpeechButton";
import "./globals.css";

const emergencyCopy = "This app cannot assess an emergency. Alert your lab supervisor or TA now and follow the lab's posted emergency procedures. Contact local emergency services when immediate help is needed.";

export default function Home() {
  const [activity, setActivity] = useState("");
  const [help, setHelp] = useState("");
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [inputMode, setInputMode] = useState<"typed" | "voice_confirmed">("typed");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<SourcePassage | null>(null);
  const [emergency, setEmergency] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const output = useRef<HTMLElement | null>(null);
  const mode = health?.appMode ?? "fixture";
  const voiceMode = health?.capabilities.voice ? mode : "disabled";
  const scientificHint = result?.findings.find(f => f.category === "scientific");
  const canContinue = result && !["emergency", "out_of_scope", "supervisor_review_required"].includes(result.state);
  const followUp = canContinue ? scientificHint?.nextStep || result.missingInformation[0] : undefined;
  const replyPrefix = `${notes ? `${notes}\n` : ""}Guide asked: ${followUp}\nMy reply: `;
  const replySpace = Math.max(0, 1000 - replyPrefix.length);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: abort.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setHealth(data); }).catch(() => {});
    return () => { abort.abort(); request.current?.abort(); };
  }, []);

  function clear() {
    sequence.current++; request.current?.abort(); setResult(null); setSource(null);
    setError(""); setReply(""); setBusy(false);
  }
  function editActivity(value: string) { clear(); setNotes(""); setActivity(value); setInputMode("typed"); }
  function editHelp(value: string) { clear(); setNotes(""); setHelp(value); setInputMode("typed"); }
  function sample() {
    clear(); setNotes(""); setInputMode("typed");
    setActivity("I’m comparing how water temperature affects how long table sugar takes to dissolve in cups of water for my chemistry class.");
    setHelp("I’m unsure what needs to stay the same in the comparison. Help me understand why that matters.");
  }
  async function submit(event: FormEvent) { event.preventDefault(); await guide(notes); }
  async function continueGuidance() {
    if (!reply.trim() || reply.length > replySpace || busy) return;
    const updated = replyPrefix + reply.trim();
    setNotes(updated); await guide(updated);
  }
  async function guide(reflections: string) {
    clear();
    const parsed = ReviewRequestSchema.safeParse({
      schemaVersion: "1.0", clientRequestId: crypto.randomUUID(), contextId: "intro-chem-demo",
      goal: activity, question: help, materials: [], equipment: [], conditions: reflections,
      // Keep the existing C001 transport; the full activity is preserved in goal.
      steps: [activity.trim().slice(0, 300)], inputMode,
    });
    if (!parsed.success) { setError("Tell us a little more about what you’re doing (at least 10 characters)."); return; }
    const token = ++sequence.current;
    const abort = new AbortController(); request.current = abort; setBusy(true);
    try {
      const response = await fetch("/api/review", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(27_000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Guidance is unavailable. Your words are preserved.");
      const checked = ReviewResponseSchema.safeParse(data);
      if (!checked.success || checked.data.clientRequestId !== parsed.data.clientRequestId) throw new Error("The guidance could not be read. Please try again.");
      if (token !== sequence.current) return;
      setResult(checked.data); setTimeout(() => output.current?.focus(), 0);
    } catch (failure) {
      if (token === sequence.current) setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Guidance timed out. Please try again.");
    } finally { if (token === sequence.current) setBusy(false); }
  }

  return <div className="workspace">
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon">L<span>•</span></span>LabMate <small>AI</small></a><div className="top-meta"><i className={mode} />{health ? `${mode === "live" ? "Live" : "Fixture"} workspace` : "Connecting…"}</div></header>
    <main>
      <section className="intro"><div><p className="eyebrow">YOUR LAB LEARNING COMPANION</p><h1>What are you doing?<br /><span>Let’s work through it.</span></h1><p className="intro-copy">Tell us what you’re working on and where you’d like a hand.</p></div></section>
      <div className="mode-banner"><b>{mode === "live" ? "● Live guidance" : "◈ Sample mode"}</b><span>{mode === "live" ? "Your words are sent to xAI. General learning context comes from NIST." : "Responses are canned examples, not guidance generated for your input."}</span></div>
      <div className="columns">
        <section className="plan-panel">
          <div className="panel-heading"><h2>Start here</h2><button type="button" className="text-button" onClick={sample} disabled={busy}>Try an example ↗</button></div>
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="activity">What are you doing?</label><p id="activity-hint">A sentence or two is enough. It’s okay to be unsure.</p><textarea id="activity" aria-describedby="activity-hint" value={activity} minLength={10} maxLength={1000} rows={4} required onChange={event => editActivity(event.target.value)} placeholder="I’m working on…" /></div>
            <div className="field"><label htmlFor="help">What do you need help with?</label><textarea id="help" value={help} maxLength={500} rows={3} required onChange={event => editHelp(event.target.value)} placeholder="I’m stuck on… / Help me understand…" /></div>
            {error && <p className="error-box" role="alert">{error}</p>}
            <div className="submit-row"><small>Intro chemistry · classroom preparation</small><div>{busy && <button type="button" className="secondary-button" onClick={clear}>Cancel</button>}<button className="primary-button" disabled={busy}>{busy ? "Thinking with you…" : "Help me out →"}</button></div></div>
          </form>
          <details className="voice-panel"><summary>Prefer to speak? <span>Voice input</span></summary>
            <VoiceRecorder mode={voiceMode} disabled={busy} onConfirm={text => {
              clear(); setNotes("");
              if (text.length <= 1000) { setActivity(text); setInputMode("voice_confirmed"); setVoiceDraft(""); }
              else setVoiceDraft(text);
            }} />
            {voiceDraft && <div className="voice-draft"><label htmlFor="voice-draft">Your voice draft</label><textarea id="voice-draft" value={voiceDraft} maxLength={5000} onChange={event => { setVoiceDraft(event.target.value); setInputMode("typed"); }} /><p>Use up to 1,000 characters to describe what you’re doing.</p><button type="button" className="secondary-button" disabled={!voiceDraft.trim() || voiceDraft.length > 1000} onClick={() => { clear(); setNotes(""); setActivity(voiceDraft); setInputMode("typed"); setVoiceDraft(""); }}>Use this description</button></div>}
          </details>
        </section>
        <aside className="review-panel" ref={output} tabIndex={-1} aria-label="Your guide">
          <div className="panel-heading"><h2>Let’s figure it out</h2><span className="review-symbol">✧</span></div>
          <p className="sr-only" role="status" aria-live="polite">{busy ? "Preparing guidance" : result ? "Guidance ready" : "Ready when you are"}</p>
          {busy ? <div className="empty-review"><div className="orb loading">⌁</div><h3>Thinking with you…</h3></div> : !result ? <div className="empty-review"><div className="orb">⌁</div><h3>A little help, one step at a time.</h3><p>Share what you’re doing. We’ll focus on the part you need help with.</p></div> : <div className="result-content">
            {result.meta.mode === "fixture" && <p className="pill">CANNED EXAMPLE · not generated for your input</p>}
            <div className={`result-status ${result.state}`}>
              {result.state === "emergency" && <h3>Get help from your supervisor now</h3>}
              {result.state === "supervisor_review_required" && <h3>Ask your TA before continuing</h3>}
              <p>{result.summary}</p>
            </div>
            {result.findings.filter(f => f.category === "safety").map(f => <section className="result-section" key={f.id}><h4>{f.severity === "stop" ? "Speak with your TA first" : "A question for your TA"}</h4><p>{f.explanation}</p><p>{f.nextStep}</p></section>)}
            {scientificHint && <p className="learning-hint">{scientificHint.explanation}</p>}
            {followUp && <section className="coaching-step" aria-labelledby="follow-up"><h4 id="follow-up">{followUp}</h4>{replySpace > 20 ? <><label htmlFor="reply">Your thinking</label><textarea id="reply" value={reply} rows={3} maxLength={replySpace} placeholder="I think… / I’m not sure because…" onChange={event => setReply(event.target.value)} /><button type="button" className="primary-button" disabled={!reply.trim() || busy} onClick={() => void continueGuidance()}>Continue →</button></> : <p>Put your next question in “What do you need help with?” to start a fresh thought.</p>}</section>}
            {result.state === "supervisor_review_required" && result.questionsForTA[0] && <p>{result.questionsForTA[0]}</p>}
            <details className="limits"><summary>Sources & limits</summary>{result.sources.map(item => <button type="button" className="source-card" key={item.sourceId} onClick={() => setSource(item)}><span>↗</span><div><b>{item.title}</b><small>{item.locator}</small></div></button>)}<ul>{[...result.limits, ...result.meta.warnings].map((item, index) => <li key={index}>{item}</li>)}</ul></details>
            <details className="readback"><summary>Listen to this</summary><SpeechButton mode={voiceMode} speechText={result.speechText} /></details>
          </div>}
        </aside>
      </div>
      <footer><span>Follow your course protocol and your lab supervisor’s guidance.</span><button type="button" onClick={() => setEmergency(true)}>Possible emergency? Get guidance ↗</button></footer>
    </main>
    {(source || emergency) && <div className="modal-backdrop" onClick={() => { setSource(null); setEmergency(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={emergency ? "Emergency guidance" : "Source passage"} onClick={event => event.stopPropagation()}><button type="button" className="modal-close" autoFocus onClick={() => { setSource(null); setEmergency(false); }}>Close ×</button>{emergency ? <><h2>Contact your lab supervisor.</h2><p>{emergencyCopy}</p></> : source && <><h2>{source.title}</h2><p>{source.locator}</p><blockquote>{source.excerpt}</blockquote><small>{source.sourceKind.replaceAll("_", " ")} · checked {source.reviewedOn}</small>{source.url && <p><a href={source.url} target="_blank" rel="noopener noreferrer">Open original source ↗</a></p>}<p>General guidance does not replace your course protocol or applicable SDS.</p></>}</section></div>}
  </div>;
}
