import "server-only";
import { parseBuffer } from "music-metadata";
import { VoiceError } from "./http";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 30;

export interface ValidatedAudio {
  bytes: Uint8Array;
  mimeType: "audio/webm" | "audio/mp4";
  duration: number;
}

export async function validateAudio(file: File): Promise<ValidatedAudio> {
  if (file.size > MAX_AUDIO_BYTES) throw new VoiceError(413, "VALIDATION_ERROR", "Recordings must be at most 5 MiB.");
  if (file.size === 0) throw new VoiceError(422, "VALIDATION_ERROR", "The recording is empty.");
  const mime = file.type.split(";")[0].toLowerCase();
  if (mime !== "audio/webm" && mime !== "audio/mp4") throw new VoiceError(415, "VALIDATION_ERROR", "Use a supported WebM or MP4 audio recording.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatureMatches = mime === "audio/webm"
    ? bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
    : bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === "ftyp";
  if (!signatureMatches) throw new VoiceError(415, "VALIDATION_ERROR", "The recording does not match its audio type.");
  let duration: number | undefined;
  try {
    const metadata = await parseBuffer(bytes, { mimeType: mime, size: bytes.length }, { duration: true, skipCovers: true });
    if (!metadata.format.numberOfChannels || !metadata.format.codec) throw new Error("No audio track");
    duration = metadata.format.duration;
  } catch {
    throw new VoiceError(422, "VALIDATION_ERROR", "The recording could not be read. Please type your plan or try another browser.");
  }
  if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > MAX_RECORDING_SECONDS) {
    throw new VoiceError(422, "VALIDATION_ERROR", "Audio must have a readable duration of at most 30 seconds. Please type your plan or try another browser.");
  }
  return { bytes, mimeType: mime, duration };
}
