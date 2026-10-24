// Serve the PDF.js worker from this origin; it contains no application data.
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public/sable", { recursive: true });
await copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/sable/pdf.worker.min.mjs");
