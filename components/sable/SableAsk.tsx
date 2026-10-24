"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { ArrowDownRight, Loader2, MessageCircle, Mic, Send, Square } from "lucide-react";
import { VoiceCoach } from "@/components/voice/VoiceCoach";
import { type LabConversation, type Message } from "./useLabConversation";
import { cn } from "./utils";
import { SableAvatar } from "./SableAvatar";

function Reply({ message, onPageChange }: { message: Message; onPageChange: (page: number) => void }) {
  if (message.role === "user") return <article className="rounded-lg bg-secondary/70 p-3"><p className="mb-1 text-xs font-bold text-muted-foreground">YOU</p><p className="whitespace-pre-wrap">{message.text}</p></article>;
  if (message.role === "prep") return <article className="rounded-lg border border-border/20 bg-paper/60 p-3"><p className="mb-1 text-xs font-bold text-primary">SABLE · GETTING READY {message.step} OF 4</p><p>{message.text}</p><a href={message.source} target="_blank" rel="noopener noreferrer" className="sable-prep-source mt-2 inline-flex items-center text-sm font-bold text-primary underline underline-offset-4">General preparation · ACS reference ↗</a></article>;
  const { reply } = message;
  const precautions = reply.precautions.length > 0 ? <div className="mt-3"><h3 className="font-bold">{message.opening ? "Safety notes and warnings" : "Precautions from your handout"}</h3><ul className="mt-1 list-disc space-y-2 pl-4">{reply.precautions.map((precaution, index) => <li key={index}>{precaution.quote} <button type="button" onClick={() => onPageChange(precaution.page)} className="font-bold text-primary underline underline-offset-2">p. {precaution.page}</button></li>)}</ul></div> : message.opening ? <p className="my-3 rounded-lg bg-hazard/20 p-3">No safety notes could be verified in this handout.{!reply.webSources.some(source => source.kind === "precaution") ? " Ask your TA which precautions apply." : " Online references are listed below."}</p> : null;
  const webReferences = reply.webSources.length > 0 ? <div className="mt-4 border-t border-border/20 pt-3">
    <h3 className="font-bold">{message.opening ? "Precautions from online references" : "Online references checked"}</h3>
    <p className="mt-1 text-sm text-muted-foreground">General guidance. Your course protocol and TA determine what applies.</p>
    <ul className="mt-2 space-y-3">{reply.webSources.map(source => <li key={source.id} className="sable-web-source rounded-lg bg-secondary/50 p-3">
      <blockquote>{source.quote}</blockquote>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center font-bold text-primary underline underline-offset-4">{source.title} ↗</a>
    </li>)}</ul>
  </div> : ["unavailable", "no_sources"].includes(reply.researchStatus) ? <p className="my-3 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">I couldn’t verify additional web sources this time. This reply uses your handout and conversation.</p> : reply.researchStatus === "disabled" && reply.mode === "live" ? <p className="mt-3 text-sm text-muted-foreground">Web lookup is off. This reply uses your handout and conversation.</p> : null;
  return <article className="rounded-lg border border-border/20 bg-paper/60 p-3">
    <p className="mb-1 text-xs font-bold text-primary">{reply.mode === "fixture" ? "SAMPLE RESPONSE" : message.opening ? "SABLE · YOUR LAB BRIEF" : "SABLE"}</p>
    {message.opening && precautions}
    {message.opening && webReferences}
    {message.opening && <h3 className="mt-4 mb-2 font-bold">Key points</h3>}
    <p className="whitespace-pre-wrap">{reply.answer}</p>
    {!message.opening && precautions}
    {!message.opening && webReferences}
    {reply.citations.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span>From your handout:</span>{reply.citations.map(page => <button type="button" key={page} onClick={() => onPageChange(page)} className="font-bold text-primary underline underline-offset-2">p. {page}</button>)}</div>}
  </article>;
}

/** The existing voice engine, presented through the original Sable controls. */
export function SableAsk({ conversation, onPageChange, autoStartSignal = 0, preparedAudio }: { conversation: LabConversation; onPageChange: (page: number) => void; autoStartSignal?: number; preparedAudio?: RefObject<AudioContext | null> }) {
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const automaticText = useRef(0);
  const { messages, thinking, voiceActive } = conversation;
  useEffect(() => { if (open || logOpen) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, thinking, open, logOpen]);
  useEffect(() => {
    if (!autoStartSignal || automaticText.current === autoStartSignal || !conversation.health || conversation.voiceMode !== "disabled") return;
    const timer = setTimeout(() => {
      automaticText.current = autoStartSignal;
      setOpen(true); setTyping(true);
      void conversation.begin();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoStartSignal, conversation.health, conversation.voiceMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || thinking || voiceActive) return;
    setQuestion(""); setLogOpen(true);
    await conversation.respond(text);
  }

  function viewPage(page: number) { onPageChange(page); setOpen(false); setLogOpen(false); }
  async function begin() {
    setLogOpen(false); setOpen(true); setTyping(false);
    return conversation.begin();
  }
  async function answer(transcript: string): Promise<{ text: string; endSession?: boolean } | undefined> {
    return conversation.respond(transcript);
  }

  return <VoiceCoach mode={conversation.voiceMode} disabled={thinking} continuous stopSignal={conversation.stopSignal} autoStartSignal={autoStartSignal} preparedAudio={preparedAudio}
    onBegin={begin} onTranscript={answer} onActiveChange={conversation.setVoiceActive} onCancel={conversation.cancelPending}
    renderControls={({ active, phase, status, error, notice, toggle }) => <>
      <div className="sable-controls flex shrink-0 items-center gap-2">
        <button type="button" aria-label="Show conversation log" title="Conversation and optional typing" aria-expanded={logOpen} aria-controls="sable-conversation" onClick={() => { setLogOpen(value => !value); setOpen(false); }} className="sable-log flex shrink-0 items-center justify-center rounded-full border border-border/20 bg-paper/70 text-primary transition-colors hover:bg-secondary">
          <MessageCircle className="size-4" />
        </button>
        <button type="button" aria-label={active ? "End SABLE conversation" : conversation.voiceMode === "disabled" ? "Ask SABLE" : "Talk to SABLE"} disabled={!active && (thinking || !conversation.health)}
          onClick={() => {
            if (active) { toggle(); return; }
            setLogOpen(false); setOpen(true);
            if (conversation.voiceMode === "disabled") { setTyping(true); void conversation.begin(); }
            else { setTyping(false); toggle(); }
          }}
          className={cn("sable-talk cartoon-sm flex h-12 shrink-0 items-center gap-1 rounded-full py-1 pl-1 pr-3 transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50", active ? "bg-secondary text-secondary-foreground" : "bg-hazard text-hazard-foreground")}>
          <SableAvatar phase={thinking && phase === "idle" ? "thinking" : phase} awake={open || logOpen} className="!size-12" />
          <span className="flex flex-col items-start text-left"><span className="flex items-center gap-1.5 font-display text-sm font-semibold">{active ? <Square className="size-3 fill-current" /> : <Mic className="size-3" />}{active ? "End conversation" : conversation.voiceMode === "disabled" ? "Ask Sable" : "Talk to Sable"}</span><span className="text-[9px] font-medium opacity-70" role="status">{active ? phase === "listening" ? "Listening · your turn" : phase === "reading" || phase === "asking" ? "Speaking to you" : "Thinking with you…" : conversation.briefed.current ? "Pick up where we left off" : "Let’s get ready together"}</span></span>
        </button>
      </div>
      {(open || logOpen) && <section id="sable-conversation" aria-label="SABLE conversation" className="sable-conversation cartoon absolute inset-x-3 bottom-16 z-20 flex h-[min(61dvh,29rem)] flex-col rounded-xl bg-card p-4 text-sm sm:left-auto sm:right-5 sm:w-[min(32rem,calc(100%-2.5rem))]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/20 pb-2">
          <h3 className="font-display text-lg font-semibold">{logOpen ? "Our conversation" : "A little help from Sable"}</h3>
          <button type="button" aria-label="Back to handout" title={active ? "Read your handout while Sable keeps listening" : "Back to handout"} onClick={() => { setOpen(false); setLogOpen(false); }} className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/70 px-2 py-1.5 text-[10px] font-bold text-primary">Handout<ArrowDownRight className="size-3.5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-3 pr-1 leading-relaxed">
          {!messages.length && !thinking && <div className="flex flex-col items-center py-3 text-center"><SableAvatar awake className="!size-24" /><p className="mt-2 max-w-64 text-muted-foreground">{conversation.voiceMode === "disabled" ? "Ask me about your experiment below." : "I’ll check your handout and online references, share key precautions, then answer your questions out loud."}</p></div>}
          {(logOpen ? messages : messages.slice(-2)).map(message => <Reply key={message.id} message={message} onPageChange={viewPage} />)}
          {thinking && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking your handout and reliable web sources…</p>}
          {status && !thinking && <p role="status" className="font-semibold text-primary">{status}</p>}
          {(error || conversation.error) && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">{conversation.error || error}</p>}
          {notice && <p role="status" className="text-muted-foreground">{notice}</p>}
          <div ref={end} />
        </div>
        {typing ? <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-border/20 pt-3">
          <label className="sr-only" htmlFor="sable-question">Your question for SABLE</label>
          <textarea id="sable-question" rows={2} maxLength={5000} value={question} onChange={event => setQuestion(event.target.value)} disabled={active || thinking} placeholder={active ? "End the voice conversation to type." : "Type a question for SABLE…"} className="min-w-0 flex-1 resize-none rounded-lg border border-border/30 bg-paper p-2 text-sm disabled:opacity-60" />
          <button type="submit" disabled={active || thinking || !question.trim()} className="sable-end-turn cartoon-sm flex shrink-0 items-center justify-center rounded-full bg-hazard font-bold disabled:opacity-40"><Send className="size-4" /><span>End turn</span></button>
        </form> : <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/20 pt-3"><span className="text-[11px] text-muted-foreground">{conversation.prepStep ? `Preparation ${conversation.prepStep} of 4 · reply when ready.` : active ? "Pause after a question. I’ll take it from there." : "One tap to pick up our conversation."}</span><button type="button" onClick={() => { if (active) toggle(); setTyping(true); }} className="shrink-0 text-xs font-bold text-primary underline underline-offset-4">Type instead</button></div>}
        <p className="mt-2 shrink-0 text-[10px] leading-snug text-muted-foreground">{conversation.voiceMode === "disabled" ? "Voice is unavailable. You can type a question. " : "Voice uses ElevenLabs. "}Handout text and questions go to xAI. Web searches use public experiment topics. This conversation stays in memory.{conversation.mode === "fixture" ? " Sample mode uses canned responses." : ""}</p>
      </section>}
    </>} />;
}
