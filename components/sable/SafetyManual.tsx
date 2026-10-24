"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, FileText, Loader2, ShieldCheck, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { LabDocumentSchema, type LabDocument } from "@/lib/lab/contracts";
import { cn } from "./utils";
import { SableAsk } from "./SableAsk";
import { PdfPage } from "./PdfPage";
import { useLabConversation } from "./useLabConversation";

type LabModule = { name: string; mediaType: string; pages: Array<{ text: string }>; size: number; document: LabDocument; file?: File };
const MAX_BYTES = 5 * 1024 * 1024;
const PAGE_CHARS = 1100;

function splitTextPages(text: string): string[] {
  const pages: string[] = [];
  let rest = text.replace(/\r\n/g, "\n").trim();
  while (rest) {
    let cut = rest.length <= PAGE_CHARS ? rest.length : rest.lastIndexOf("\n", PAGE_CHARS);
    if (cut < PAGE_CHARS - 100) cut = Math.min(rest.length, PAGE_CHARS);
    pages.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  return pages;
}

async function readModule(file: File, signal: AbortSignal): Promise<LabModule> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
  if (!isPdf && !isText) throw new Error("Please upload a PDF, TXT or MD file.");
  if (file.size > MAX_BYTES) throw new Error("Use a handout smaller than 5 MiB.");
  let document: LabDocument;
  if (isPdf) {
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/lab", { method: "POST", body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(17_000)]) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "That PDF could not be read.");
    const parsed = LabDocumentSchema.safeParse(data.document);
    if (!parsed.success) throw new Error("The PDF text could not be read.");
    document = parsed.data;
  } else {
    const text = (await file.text()).replace(/\r\n/g, "\n").trim();
    if (!text) throw new Error("That file is empty. Choose a handout with readable text.");
    if (text.length > 24000) throw new Error("Use a handout with up to 24,000 characters.");
    const pages = splitTextPages(text).map((text, index) => ({ number: index + 1, text }));
    document = LabDocumentSchema.parse({ title: file.name.slice(0, 160), pages });
  }
  signal.throwIfAborted();
  return { name: file.name, mediaType: isPdf ? "application/pdf" : "text/plain", pages: document.pages, size: file.size, document, ...(isPdf ? { file } : {}) };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Anim = "rise" | "sink" | null;

/**
 * Upload button + the safety manual as a stack of paper sheets. The first
 * sheet slides up from the bottom onto the table; down pulls the next sheet
 * up, up pulls the current sheet back down to reveal the previous one.
 */
export function SafetyManual({ children }: { children: ReactNode }) {
  const [mod, setMod] = useState<LabModule | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [anim, setAnim] = useState<Anim>(null);
  const [leaving, setLeaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoStartSignal, setAutoStartSignal] = useState(0);
  const preparedAudio = useRef<AudioContext | null>(null);
  const emergency = useRef<HTMLDialogElement>(null);
  const conversation = useLabConversation(mod?.document ?? null);
  useEffect(() => () => { upload.current?.abort(); void preparedAudio.current?.close().catch(() => {}); }, []);

  function preparePlayback() {
    if (typeof AudioContext === "undefined" || conversation.voiceMode === "disabled") return;
    try {
      if (!preparedAudio.current || preparedAudio.current.state === "closed") preparedAudio.current = new AudioContext();
      void preparedAudio.current.resume().catch(() => {});
    } catch { /* Upload and optional typing remain available. */ }
  }

  const onFile = async (file?: File) => {
    if (!file) return;
    upload.current?.abort();
    const abort = new AbortController(); upload.current = abort;
    setLoading(true);
    try {
      const loaded = await readModule(file, abort.signal);
      if (abort.signal.aborted) return;
      setZoom(1); setPageIndex(0); setLeaving(false); setAnim("rise"); setMod(loaded);
      setAutoStartSignal(value => value + 1);
      toast.success(`Loaded "${file.name}" — ${loaded.pages.length} page${loaded.pages.length === 1 ? "" : "s"}`);
    } catch (e) {
      if (!abort.signal.aborted) toast.error(e instanceof Error ? e.message : "The handout could not be read.");
    } finally {
      if (upload.current === abort) { upload.current = null; setLoading(false); }
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const goDown = () => {
    if (!mod || pageIndex >= mod.pages.length - 1 || anim) return;
    setPageIndex((i) => i + 1);
    setAnim("rise");
  };

  const goUp = () => {
    if (!mod || pageIndex <= 0 || anim) return;
    setAnim("sink");
  };

  const putAway = () => {
    if (anim) return;
    conversation.stop();
    setLeaving(true);
    setAnim("sink");
  };

  const onSheetAnimationEnd = () => {
    if (anim === "rise") {
      setAnim(null);
      return;
    }
    if (anim !== "sink") return;
    if (leaving) {
      setMod(null);
      setLeaving(false);
      setPageIndex(0);
    } else {
      setPageIndex((i) => Math.max(0, i - 1));
    }
    setAnim(null);
  };

  const pageCount = mod?.pages.length ?? 0;
  const currentPage = mod?.pages[pageIndex];

  return (
    <>
      <footer className="sable-footer absolute inset-x-3 bottom-1 z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center font-semibold text-muted-foreground">
        <span>Your course protocol and lab supervisor remain authoritative.</span>
        <button type="button" onClick={() => { conversation.stop(); emergency.current?.showModal(); }} className="underline underline-offset-2">Possible emergency?</button>
      </footer>
      <dialog ref={emergency} className="cartoon fixed inset-0 m-auto max-w-[min(90vw,30rem)] rounded-xl bg-card p-6 text-foreground backdrop:bg-foreground/40">
        <h2 className="font-display text-2xl font-semibold">Contact your lab supervisor.</h2>
        <p className="my-4 leading-relaxed">This app cannot assess an emergency. Alert your lab supervisor or TA now and follow the lab’s posted emergency procedures. Contact local emergency services when immediate help is needed.</p>
        <button type="button" onClick={() => emergency.current?.close()} className="cartoon-sm rounded-full bg-hazard px-4 py-2 font-bold">Close</button>
      </dialog>
      <div className="sable-connection absolute right-4 top-4 z-10 rounded-full border border-border/15 bg-card/90 px-3 py-1 text-xs font-semibold text-muted-foreground" role="status">
        {conversation.connectionError || (!conversation.health ? "Connecting…" : conversation.mode === "fixture" ? "Sample mode" : conversation.voiceMode === "disabled" ? "Voice unavailable · typing available" : "SABLE · voice ready")}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        disabled={loading}
        aria-label="Upload lab handout"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!mod && (
        <section className="sable-landing" aria-label="Start with your lab handout">
          {children}
        <button
          type="button"
          aria-label="Upload lab handout"
          disabled={loading}
          onClick={() => { preparePlayback(); fileRef.current?.click(); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!loading) { preparePlayback(); void onFile(e.dataTransfer.files[0]); }
          }}
          className="sable-upload cartoon-sm flex items-center gap-2 rounded-full bg-hazard font-display font-bold text-hazard-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <span role="status">{loading ? "Reading your handout…" : "Upload lab handout"}</span>
        </button>
        <p className="sable-upload-hint text-center font-semibold text-muted-foreground">Safety notes first, then your questions.<br /><span className="text-muted-foreground">PDF, TXT or MD · up to 25 pages · 5 MiB</span></p>
        <img src="/sable/sable-sleep.png" alt="" width={1024} height={1024} className="sable-landing-mascot animate-[sable-bob_3.6s_ease-in-out_infinite] drop-shadow-md" />
        </section>
      )}

      {mod && (
        <>
          {/* sheet peeking out underneath, to suggest a stack */}
          <div
            aria-hidden
            className="sable-sheet-back cartoon absolute left-1/2 top-1/2 rounded-md bg-paper"
            style={{ transform: "translate(-50%, -50%) rotate(.8deg) translateY(5px)" }}
          />
          <div
            role="document"
            aria-label={`Lab handout: ${mod.name}, page ${pageIndex + 1} of ${pageCount}`}
            onAnimationEnd={event => { if (event.target === event.currentTarget) onSheetAnimationEnd(); }}
            style={anim ? undefined : { transform: "translate(-50%, -50%)" }}
            className={cn(
              "sable-sheet cartoon absolute left-1/2 top-1/2 flex flex-col rounded-md bg-card",
              anim === "rise" && "animate-[paper-rise_.6s_ease-in-out_both]",
              anim === "sink" && "animate-[paper-sink_.6s_ease-in-out_both]",
            )}
          >
            {/* tape strip */}
            <div aria-hidden className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-[-3deg] rounded-sm bg-accent/90 shadow-sm" />

            <button
              type="button"
              aria-label="Put manual away"
              onClick={putAway}
              className="sable-sheet-close cartoon-sm absolute -right-3 -top-3 flex items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            <div className="sable-sheet-header border-b-2 border-dashed border-border">
              <span className="cartoon-sm flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {pageIndex === 0 ? <ShieldCheck className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div className="sable-sheet-heading min-w-0">
                <h2 className="font-display text-lg font-bold leading-tight text-foreground">
                  {pageIndex === 0 ? "Lab handout" : mod.name}
                </h2>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {pageIndex === 0
                    ? `${mod.name} · ${mod.mediaType === "application/pdf" ? "PDF" : "TEXT"} · ${formatSize(mod.size)}`
                    : "Lab handout"}
                </p>
              </div>
              <div className="sable-sheet-controls">
                <SableAsk conversation={conversation} autoStartSignal={autoStartSignal} preparedAudio={preparedAudio} onPageChange={number => {
                  const index = mod.document.pages.findIndex(page => page.number === number);
                  if (index >= 0) { setPageIndex(index); setZoom(1); }
                }} />
              </div>
            </div>

            {mod.file ? <PdfPage file={mod.file} page={pageIndex + 1} zoom={zoom} text={currentPage?.text ?? ""} /> : (
              <div className="sable-text-page mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap pr-1 text-base font-medium leading-relaxed text-foreground" style={{ fontSize: `${16 * zoom}px` }}>
                {currentPage?.text}
              </div>
            )}

            <div className="sable-sheet-nav flex flex-wrap items-center justify-between gap-2 pt-3">
              <div className="flex gap-2">
                {mod.file && (
                  <>
                    <button
                      type="button"
                      aria-label="Zoom out"
                      onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 100) / 100))}
                      disabled={zoom <= 1 || anim !== null}
                      title="Zoom out"
                      className="cartoon-sm flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      <ZoomOut className="size-4" />
                    </button>
                    <span className="sable-zoom-level self-center text-center font-mono text-sm" aria-live="polite">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                      disabled={zoom >= 3 || anim !== null}
                      title="Zoom in"
                      className="cartoon-sm flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      <ZoomIn className="size-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={goUp}
                  disabled={pageIndex === 0 || anim !== null}
                  title="Previous page"
                  className="cartoon-sm flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
                >
                  <ChevronUp className="size-5" />
                </button>
                <span className="min-w-16 text-center font-display text-sm font-bold text-muted-foreground">
                  {pageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={goDown}
                  disabled={pageIndex >= pageCount - 1 || anim !== null}
                  title="Next page"
                  className="cartoon-sm flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
                >
                  <ChevronDown className="size-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
