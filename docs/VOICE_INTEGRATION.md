# D voice integration handoff

Owner: D. These implementations are on `feat/voice-integration`. C001 is still PENDING: B must publish shared contracts and the affected owners must explicitly agree before these interfaces are merged or mounted in A's page. Live ElevenLabs transcription of synthetic MP4 and MP3 readback through the production server routes passed on October 24 at approximately 12:36 PM New York time. An actual browser microphone journey remains unverified; see docs/TRACK_EVIDENCE.md.

## Components proposed for B's contract

```ts
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { SpeechButton } from "@/components/voice/SpeechButton";

interface VoiceRecorderProps {
  onConfirm: (transcript: string) => void;
  disabled?: boolean;
  mode?: "disabled" | "fixture" | "live"; // defaults to disabled
}
interface SpeechButtonProps {
  speechText: string;
  disabled?: boolean;
  mode?: "disabled" | "fixture" | "live"; // defaults to disabled
}
```

A owns form state. `onConfirm` fills a draft only: it must not submit a review. A maps the text into the bounded form fields, preserves student edits, and sets `inputMode: "voice_confirmed"` only after confirmation. Editing the transcript invalidates confirmation. Pass only the newest validated review's `speechText` to `SpeechButton`; changing that prop cancels stale playback and releases its URL. Clear it when form edits invalidate the old review. Both components keep text available on failure and use explicit consent. D will align these local implementation props with B's accepted exports once published; they do not constitute an independent shared contract.

## HTTP and provider behavior

- `/api/transcribe`: multipart `file` plus `consent=true`; no other fields, duplicates, URLs, or caller-supplied duration. Success is `{requestId, transcript, requiresConfirmation: true}` with `X-LabMate-Mode: fixture|live`.
- `/api/speech`: strict JSON `{text, consent: true}`, 1–900 trimmed characters. Returns MP3 bytes and mode/request ID headers. The configured voice and model cannot be overridden by a caller.
- Errors follow handoff section 9: `{requestId,error:{code,message,retryable}}`. Every response is `no-store`; provider errors and credentials are not echoed. Cross-origin calls are rejected with 403.
- Audio is limited to 5 MiB and a finite readable duration of at most 30 seconds. The pinned `music-metadata` parser checks container metadata after MIME and signature checks. Unknown duration is rejected. Browser streaming WebM often lacks duration; MP4 is preferred when supported. Synthetic MP4 is provider-verified; actual browser capture and live WebM remain unverified.
- The recorder stops at 29 seconds to allow encoder padding. Cancelling, disabling, navigating away, or resolving a late permission request releases the microphone. Cancellation propagates to fetch. Voice endpoints use a shared 15-second deadline and bounded streaming body reads.
- Fixture transcription returns clearly labeled synthetic sample text. Fixture speech plays a prerecorded announcement (“This is fixture audio…”), rather than pretending to synthesize the submitted review. Fixture mode never calls ElevenLabs. The bytes are bundled in the standalone deployment output.

## Local setup and live verification

Use Node 24 from `.nvmrc`, `npm ci`, and copy `.env.example` to `.env.local` if it does not already exist. Secrets belong only in `.env.local` or the deployment host's secret settings. The file is ignored by Git. Set `ENABLE_VOICE=true` with `APP_MODE=fixture` for the local fixture routes; review integration still depends on A and B.

For live tests, first redeem the event credits in the correct ElevenLabs workspace. In Developers → API Keys, create a restricted key permitting Speech to Text and Text to Speech. Optional Models read and Voices read permissions allow inspecting supported IDs. Set a provider credit limit in the dashboard. Store the key in `ELEVENLABS_API_KEY`, select an available fixed voice, and fill `ELEVENLABS_STT_MODEL`, `ELEVENLABS_TTS_MODEL`, and `ELEVENLABS_VOICE_ID`. Models `scribe_v2` and `eleven_multilingual_v2` and stock voice George (`JBFqnCBsd6RMkjVDRZzb`) have now passed live calls with this local key. Models listing returns a scoped permission denial; that does not block the tested speech endpoints. The key remains in ignored `.env.local`, and the default fixture/disabled settings were preserved after the temporary live test process stopped.

Live voice additionally requires `APP_MODE=live`, `ENABLE_VOICE=true`, `VOICE_SUPERVISED_DEMO=true`, and `VOICE_MAX_PROVIDER_CALLS` between 1 and 100. These gates allow a supervised single Node process only. The process permits at most five voice calls per minute and two concurrently, across all callers. Its live-attempt counter resets on restart, so it is not a persistent daily spend cap. Keep a provider-side quota. A shared distributed limiter is required before opening live voice on public/serverless infrastructure; until then keep it disabled there.

Run `npm run typecheck`, `npm test`, and `npm run build`. Then explicitly test a consented browser recording, correction/confirmation, and summary readback with the team's available account. Record sanitized time, tested commit, selected models, latency, mode, and result in `docs/TRACK_EVIDENCE.md`. Never record the key, account identifier, raw audio, or private student text. A fixture or configuration check does not qualify the sponsor track.

References checked October 24, 2026: [Create transcript](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [API key setup](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key).
