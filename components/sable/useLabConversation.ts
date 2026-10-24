"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HealthResponseSchema, type HealthResponse, type VoiceMode } from "@/lib/contracts";
import { ConversationReplySchema, type LabDocument, type ConversationReply, type ConversationTurn } from "@/lib/lab/contracts";
import { PREPARATION, PREP_GREETING, preparationResponse } from "@/lib/lab/preparation";
import { detectEmergency, detectOutOfScope } from "@/lib/harness/policy";
import type { ReviewRequest } from "@/lib/contracts";

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "prep"; text: string; step: number; source: string }
  | { id: string; role: "assistant"; reply: ConversationReply; opening: boolean };

export function spokenReply(reply: ConversationReply, opening = false): string {
  const onlineSafety = reply.webSources.filter(source => source.kind === "precaution");
  if (opening) return [
    reply.mode === "fixture" ? "Sample mode." : "",
    "Now, let’s go over the key warnings for your experiment.",
    ...(reply.precautions.length ? ["Your handout gives these precautions and warnings.", ...reply.precautions.map(item => item.quote)]
      : ["The handout doesn’t give verifiable safety notes."]),
    ...(onlineSafety.length ? ["I also checked reliable online references. These are general precautions to check with your TA.", ...onlineSafety.map(source => source.quote)] : []),
    !reply.precautions.length && !onlineSafety.length ? "I couldn’t verify applicable precautions. Ask your TA before beginning." : "",
    ["unavailable", "no_sources"].includes(reply.researchStatus) ? "I couldn’t verify additional web guidance this time." : "",
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
  const prepIndex = useRef(-1);
  const [prepStep, setPrepStep] = useState<number | null>(null);

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
    prepIndex.current = -1;
    setPrepStep(null);
    setMessages([]);
    setError("");
    return () => { sequence.current++; request.current?.abort(); };
  }, [lab, cancelPending]);

  function stop() {
    setStopSignal(value => value + 1);
    cancelPending();
  }

  function remember(role: "user" | "assistant", content: string) {
    history.current = [...history.current, { role, content: content.slice(0, 2500) }].slice(-12);
  }

  function preparationPrompt(index: number, greeting = false, prefix = "") {
    const step = PREPARATION[index];
    const text = prefix + (greeting ? PREP_GREETING : step.text);
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "prep", text, step: index + 1, source: step.source }]);
    remember("assistant", text);
    setPrepStep(index + 1);
    return text;
  }

  async function begin() {
    if (!lab || briefed.current) return undefined;
    if (prepIndex.current === -1) {
      prepIndex.current = 0;
      const text = preparationPrompt(0, true);
      return { text, audioUrl: mode === "live" ? "/audio/sable-prep-intro.mp3" : undefined };
    }
    if (prepIndex.current < PREPARATION.length) return PREPARATION[prepIndex.current].text;
    const reply = await ask("", true);
    if (!reply) throw new Error("The briefing could not be prepared.");
    return spokenReply(reply, true);
  }

  async function respond(message: string): Promise<{ text: string; endSession?: boolean } | undefined> {
    if (!lab) return;
    if (prepIndex.current === -1) { prepIndex.current = 0; preparationPrompt(0, true); }
    // Even a "yes" with an incident report must reach the fixed policy route.
    const probe: ReviewRequest = { schemaVersion: "1.0", clientRequestId: crypto.randomUUID(), contextId: "intro-chem-demo", goal: message, question: "", steps: [message], materials: [], equipment: [], conditions: "", inputMode: "voice" };
    if (detectEmergency(probe) || detectOutOfScope(probe)) {
      const reply = await ask(message);
      return reply ? { text: spokenReply(reply), endSession: reply.emergency } : undefined;
    }
    if (prepIndex.current < PREPARATION.length) {
      const response = preparationResponse(message, prepIndex.current);
      if (response !== "question") {
        setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", text: message }]);
        remember("user", message);
        if (response === "wait") return { text: preparationPrompt(prepIndex.current, false, "Take your time. If you need equipment or help, ask your TA. I'll stay on this step. ") };
        prepIndex.current++;
        if (prepIndex.current < PREPARATION.length) return { text: preparationPrompt(prepIndex.current) };
        setPrepStep(null);
        const reply = await ask("", true);
        return reply ? { text: spokenReply(reply, true) } : undefined;
      }
      const reply = await ask(message);
      if (!reply) return;
      const reminder = preparationPrompt(prepIndex.current, false, "When you're ready, back to our preparation: ");
      return { text: spokenReply(reply) + " " + reminder };
    }
    const opening = !briefed.current;
    const reply = await ask(message, opening);
    return reply ? { text: spokenReply(reply, opening), endSession: reply.emergency } : undefined;
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
        body: JSON.stringify({ lab, opening, message, webResearch: true, history: history.current.slice(-12) }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(38_000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "I couldn’t answer that. Please try again.");
      const parsed = ConversationReplySchema.safeParse(data);
      if (!parsed.success) throw new Error("I couldn’t read that answer. Please ask again.");
      if (token !== sequence.current) return;
      const reply = parsed.data;
      const content = [reply.answer, ...reply.precautions.map(item => item.quote), ...reply.webSources.map(source => `${source.title}: ${source.quote}`)].join("\n").slice(0, 2500);
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
  return { health, mode, voiceMode, connectionError, messages, error, thinking, voiceActive, setVoiceActive, stopSignal, cancelPending, stop, ask, begin, respond, prepStep, briefed };
}

export type LabConversation = ReturnType<typeof useLabConversation>;
