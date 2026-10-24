"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Only the visible page is rendered; the voice session stays mounted above it. */
export function PdfPage({ file, page, zoom, text }: { file: File; page: number; zoom: number; text: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const resize = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect.width ?? 600);
      if (next > 0) setWidth(previous => Math.abs(previous - next) > 4 ? next : previous);
    });
    resize.observe(node);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setPdf(null); setError(false);
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/sable/pdf.worker.min.mjs";
      const data = await file.arrayBuffer();
      if (disposed) return;
      task = pdfjs.getDocument({ data, isEvalSupported: false });
      const document = await task.promise;
      if (!disposed) setPdf(document);
    })().catch(() => { if (!disposed) { setError(true); setRendering(false); } });
    return () => { disposed = true; void task?.destroy().catch(() => {}); };
  }, [file]);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setRendering(true); setError(false);
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (disposed || !canvas.current) return;
      const original = sheet.getViewport({ scale: 1 });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = sheet.getViewport({ scale: Math.min(Math.max(1, width * zoom * density / original.width), 2000 / Math.max(original.width, original.height)) });
      const context = canvas.current.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      task = sheet.render({ canvasContext: context, viewport });
      await task.promise;
      sheet.cleanup();
      if (!disposed) setRendering(false);
    })().catch(() => { if (!disposed) { setError(true); setRendering(false); } });
    return () => { disposed = true; task?.cancel(); };
  }, [pdf, page, zoom, width]);

  return <div ref={frame} className="sable-pdf-page relative mt-3 min-h-0 flex-1 overflow-auto rounded-sm border border-border/60 bg-white">
    {rendering && <p role="status" className="p-4 text-sm text-muted-foreground">Opening page {page}…</p>}
    {error ? <div className="whitespace-pre-wrap p-5 leading-relaxed" style={{ fontSize: `${16 * zoom}px` }}><p className="mb-3 text-sm text-muted-foreground">Showing the extracted handout text.</p>{text}</div>
      : <canvas ref={canvas} role="img" aria-label={`Page ${page} of ${file.name}`} className="mx-auto block h-auto max-w-none" style={{ width: `${zoom * 100}%`, visibility: rendering ? "hidden" : "visible" }} />}
  </div>;
}
