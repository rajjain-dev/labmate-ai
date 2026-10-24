"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Mic, Send, Square, X } from "lucide-react";
import { VoiceCoach } from "@/components/voice/VoiceCoach";
import type { ConversationReply } from "@/lib/lab/contracts";
import { spokenReply, type LabConversation, type Message } from "./useLabConversation";
import { cn } from "./utils";

function Reply({ message, onPageChange }: { message: Message; onPageChange: (page: number) => void }) {
  if (message.role === "user") return <article className="rounded-lg bg-secondary/70 p-3"><p className="mb-1 text-xs font-bold text-muted-foreground">YOU</p><p className="whitespace-pre-wrap">{message.text}</p></article>;
  const { reply } = message;
  return <article className="rounded-lg border border-border/20 bg-paper/60 p-3">
    <p className="mb-1 text-xs font-bold text-primary">{reply.mode === "fixture" ? "SAMPLE RESPONSE" : message.opening ? "SABLE · YOUR LAB BRIEF" : "SABLE"}</p>
    <p className="whitespace-pre-wrap">{reply.answer}</p>
    {reply.precautions.length > 0 && <div className="mt-3"><h3 className="font-bold">Precautions from your handout</h3><ul className="mt-1 list-disc space-y-2 pl-4">{reply.precautions.map((precaution, index) => <li key={index}>{precaution.quote} <button type="button" onClick={() => onPageChange(precaution.page)} className="font-bold text-primary underline underline-offset-2">p. {precaution.page}</button></li>)}</ul></div>}
    {reply.citations.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span>From your handout:</span>{reply.citations.map(page => <button type="button" key={page} onClick={() => onPageChange(page)} className="font-bold text-primary underline underline-offset-2">p. {page}</button>)}</div>}
  </article>;
}

/** The existing voice engine, presented through the original Sable controls. */
export function SableAsk({ conversation, onPageChange }: { conversation: LabConversation; onPageChange: (page: number) => void }) {
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const { messages, thinking, voiceActive, ask } = conversation;
  useEffect(() => { if (open || logOpen) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, thinking, open, logOpen]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || thinking || voiceActive) return;
    setQuestion(""); setLogOpen(true);
    await ask(text);
  }

  function viewPage(page: number) { onPageChange(page); setOpen(false); setLogOpen(false); }
  async function begin() {
    if (conversation.briefed.current) return undefined;
    const reply = await ask("", true);
    if (!reply) throw new Error("The briefing could not be prepared.");
    return spokenReply(reply, true);
  }
  async function answer(transcript: string): Promise<{ text: string; endSession: boolean } | undefined> {
    const reply: ConversationReply | undefined = await ask(transcript);
    return reply ? { text: spokenReply(reply), endSession: reply.emergency } : undefined;
  }

  return <VoiceCoach mode={conversation.voiceMode} disabled={thinking} continuous stopSignal={conversation.stopSignal}
    onBegin={begin} onTranscript={answer} onActiveChange={conversation.setVoiceActive} onCancel={conversation.cancelPending}
    renderControls={({ active, phase, disabled, status, error, notice, toggle, finishTurn }) => <>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" aria-label="Show conversation log" aria-expanded={logOpen} aria-controls="sable-conversation" onClick={() => { setLogOpen(value => !value); setOpen(false); }} className="log-shadow shrink-0 transition-transform hover:-translate-y-0.5">
          <img src="/sable/log-icon.png" alt="" width={874} height={874} className="size-11 -rotate-45 sm:size-[3.375rem]" />
        </button>
        <div className="relative flex flex-col items-center">
          <button type="button" aria-label={active ? "End SABLE conversation" : "Talk to SABLE"} aria-pressed={active} title={active ? "End conversation" : "Hear your briefing and ask SABLE questions"} disabled={disabled}
            onClick={() => { setLogOpen(false); setOpen(true); toggle(); }}
            className={cn("cartoon-sm flex size-11 shrink-0 items-center justify-center rounded-full transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50", active ? "bg-destructive text-destructive-foreground" : "bg-hazard text-hazard-foreground", phase === "listening" && "animate-pulse")}>
            {active ? phase === "preparing" || phase === "thinking" || phase === "transcribing" ? <Loader2 className="size-5 animate-spin" /> : <Square className="size-4" /> : <Mic className="size-5" />}
          </button>
          {active && <span className="absolute -bottom-4 whitespace-nowrap text-[10px] font-bold text-primary" role="status">{phase === "listening" ? "Listening" : phase === "reading" ? "Speaking" : "One moment…"}</span>}
        </div>
        <button type="button" aria-label={active ? "Show SABLE conversation" : "Talk to SABLE"} disabled={disabled} onClick={() => { setLogOpen(false); setOpen(true); if (!active) toggle(); }} className="relative shrink-0 disabled:opacity-60">
          <img src="/sable/sable-sleep.png" alt="" width={1024} height={1024} className={cn("h-16 w-auto sm:h-18", active && "animate-[sable-bob_3s_ease-in-out_infinite]")} />
          {!active && ["z", "Z", "z"].map((letter, i) => <span key={i} aria-hidden className="pointer-events-none absolute left-[58%] top-[20%] animate-[snore-z_3.2s_ease-out_infinite] text-xs font-bold text-muted-foreground" style={{ animationDelay: `${i * 1.05}s` }}>{letter}</span>)}
        </button>
      </div>
      {(open || logOpen) && <section id="sable-conversation" aria-label="SABLE conversation" className="sable-conversation cartoon absolute inset-x-3 top-24 bottom-16 z-20 flex flex-col rounded-xl bg-card p-4 text-sm sm:inset-x-6">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/20 pb-2">
          <h3 className="font-display text-lg font-semibold">{logOpen ? "Conversation log" : "A little help from SABLE"}</h3>
          <button type="button" aria-label="Close conversation panel" onClick={() => { setOpen(false); setLogOpen(false); if (active) toggle(); }} className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-3 pr-1 leading-relaxed">
          {!messages.length && !thinking && <p className="text-muted-foreground">Tap the microphone to hear your lab briefing, then ask questions naturally. You can also type a question below.</p>}
          {(logOpen ? messages : messages.slice(-2)).map(message => <Reply key={message.id} message={message} onPageChange={viewPage} />)}
          {thinking && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{messages.length ? "SABLE is thinking…" : "Preparing your brief and the handout’s precautions…"}</p>}
          {status && !thinking && <p role="status" className="font-semibold text-primary">{status}</p>}
          {phase === "listening" && <button type="button" onClick={finishTurn} className="cartoon-sm rounded-full bg-secondary px-3 py-1.5 font-bold">Send this turn</button>}
          {(error || conversation.error) && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">{conversation.error || error}</p>}
          {notice && <p role="status" className="text-muted-foreground">{notice}</p>}
          <div ref={end} />
        </div>
        <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-border/20 pt-3">
          <label className="sr-only" htmlFor="sable-question">Your question for SABLE</label>
          <textarea id="sable-question" rows={2} maxLength={5000} value={question} onChange={event => setQuestion(event.target.value)} disabled={active || thinking} placeholder={active ? "End the voice conversation to type." : "Type a question for SABLE…"} className="min-w-0 flex-1 resize-none rounded-lg border border-border/30 bg-paper p-2 text-sm disabled:opacity-60" />
          <button type="submit" aria-label="Send question" disabled={active || thinking || !question.trim()} className="cartoon-sm flex size-10 shrink-0 items-center justify-center rounded-full bg-hazard disabled:opacity-40"><Send className="size-4" /></button>
        </form>
        <p className="mt-2 shrink-0 text-[10px] leading-snug text-muted-foreground">{conversation.voiceMode === "disabled" ? "Voice is unavailable. You can type a question. " : "Voice uses ElevenLabs. "}Handout text and questions go to xAI. This conversation stays in memory.{conversation.mode === "fixture" ? " Sample mode uses canned responses." : ""}</p>
      </section>}
    </>} />;
}
