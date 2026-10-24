"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HealthResponseSchema, type HealthResponse, type VoiceMode } from "@/lib/contracts";
import { ConversationReplySchema, type LabDocument, type ConversationReply, type ConversationTurn } from "@/lib/lab/contracts";

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: ConversationReply; opening: boolean };

export function spokenReply(reply: ConversationReply, opening = false): string {
  if (opening) return [
    reply.mode === "fixture" ? "Sample mode." : "",
    "Hi, I’m Sable. Let’s go over some key safety things first.",
    ...(reply.precautions.length ? ["Your handout gives these precautions and warnings.", ...reply.precautions.map(item => item.quote)]
      : ["I couldn’t verify any safety notes in this handout. Ask your TA which precautions apply before beginning."]),
    "Now, the key points.",
    reply.answer,
    "What would you like to know? You can ask me anything about your experiment.",
  ].filter(Boolean).join(" ");
  return [
    reply.mode === "fixture" ? "Sample mode." : "",
    reply.answer,
    ...(reply.precautions.length ? ["The handout lists these precautions.", ...reply.precautions.map(item => item.quote)] : []),
  ].filter(Boolean).join(" ");
}

export function useLabConversation(lab: LabDocument | null) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [stopSignal, setStopSignal] = useState(0);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const history = useRef<ConversationTurn[]>([]);
  const briefed = useRef(false);

  const cancelPending = useCallback(() => {
    sequence.current++;
    request.current?.abort();
    request.current = null;
    setThinking(false);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) })
      .then(async response => {
        if (!response.ok) throw new Error();
        const parsed = HealthResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error();
        if (!abort.signal.aborted) setHealth(parsed.data);
      }).catch(() => {
        if (!abort.signal.aborted) setConnectionError("SABLE couldn’t connect. Refresh to try again.");
      });
    return () => { abort.abort(); request.current?.abort(); };
  }, []);

  useEffect(() => {
    cancelPending();
    history.current = [];
    briefed.current = false;
    setMessages([]);
    setError("");
    return () => { sequence.current++; request.current?.abort(); };
  }, [lab, cancelPending]);

  function stop() {
    setStopSignal(value => value + 1);
    cancelPending();
  }

  async function ask(message: string, opening = false): Promise<ConversationReply | undefined> {
    if (!lab) return;
    cancelPending();
    setError("");
    const token = ++sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setThinking(true);
    if (message) setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", text: message }]);
    try {
      const response = await fetch("/api/conversation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lab, opening, message, history: history.current.slice(-12) }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(27_000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "I couldn’t answer that. Please try again.");
      const parsed = ConversationReplySchema.safeParse(data);
      if (!parsed.success) throw new Error("I couldn’t read that answer. Please ask again.");
      if (token !== sequence.current) return;
      const reply = parsed.data;
      const content = [reply.answer, ...reply.precautions.map(item => item.quote)].join("\n").slice(0, 2500);
      history.current = [...history.current, ...(message ? [{ role: "user" as const, content: message.slice(0, 2500) }] : []), { role: "assistant" as const, content }].slice(-12);
      if (opening) briefed.current = true;
      setMessages(previous => [...previous, { id: reply.requestId, role: "assistant", reply, opening }]);
      return reply;
    } catch (failure) {
      if (token === sequence.current) setError(failure instanceof Error ? failure.message : "I couldn’t answer that. Please try again.");
    } finally {
      if (token === sequence.current) { setThinking(false); request.current = null; }
    }
  }

  const mode = health?.appMode;
  const voiceMode: VoiceMode = health?.capabilities.voice ? health.appMode : "disabled";
  return { health, mode, voiceMode, connectionError, messages, error, thinking, voiceActive, setVoiceActive, stopSignal, cancelPending, stop, ask, briefed };
}

export type LabConversation = ReturnType<typeof useLabConversation>;
