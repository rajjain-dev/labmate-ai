# Sable frontend integration

The human requested the frontend in `sable-source.zip` and the existing voice agent inside Sable’s button. The exported Lovable project was extracted alongside the repository as the design reference. Its tabletop, supplied bitmap assets, typography, mascot, paper stack, manual controls, log and microphone are now used by the existing Next.js app. The original archive remains intact.

`app/page.tsx` renders the Sable frontend. `components/sable/SafetyManual.tsx` handles the manual, and `SableAsk.tsx` presents the existing `VoiceCoach` engine through Sable’s microphone and mascot. `VoiceCoach` gained an optional render callback; its audio capture, pause detection, provider requests, playback and cancellation remain shared. Sable talks through the existing `/api/lab`, `/api/conversation`, `/api/transcribe` and `/api/speech` routes. No Lovable gateway key is required. The conversation system identifies itself as SABLE; existing ElevenLabs voice configuration is preserved.

The first microphone press prepares and reads the lab brief and verified handout precautions, then listens for follow-up questions. The same button ends the conversation. The log includes optional typing and opens the page supporting a precaution or citation. The voice component and conversation state remain mounted across manual page changes. Dismissing the manual aborts pending conversation work and stops audio. Uploading a new handout starts fresh history. No app consent checkbox or transcript-confirmation gate was added.

PDF uploads keep the existing server limits of 5 MiB, 25 pages and 24,000 extracted characters. TXT/MD handouts are bounded to the same text length and converted to numbered display pages. PDF.js renders only the current PDF page; when rendering is unavailable, the extracted page text remains readable. Its worker is copied from the pinned dependency before development and production builds, then included in the standalone package. Private handouts, audio and credentials are not committed.

Verification on October 24, 2026:

- Production build and TypeScript compilation passed.
- Browser upload of a synthetic two-page PDF passed. Both page rendering and page navigation worked.
- A fresh typed question returned a live Grok answer grounded in the synthetic handout.
- Clicking a page 2 precaution opened page 2; navigating back and reopening the log retained the conversation.
- The emergency dialog opened with the fixed local escalation copy.
- Browser console had no errors or warnings in the checked journey.
- The live speech route returned HTTP 200, `audio/mpeg`, `X-LabMate-Mode: live` and 119,997 bytes for a synthetic Sable greeting.
- That generated greeting was converted to MP4 and sent through the live transcription route: HTTP 200, the expected Sable greeting transcript, and `requiresConfirmation: false`.
- Test suites remain skipped under the prior human delivery instruction. Browser microphone capture, pause detection and uninterrupted spoken turns require a human microphone trial; the above checks do not establish that result.

Sable’s local preview uses http://127.0.0.1:3108. The separate LabMate animation work retains its own checkout and port 3107. There is no new public deployment.

## Conversation polish requested by the human

Sable now has one primary Talk/End conversation button with a readable state label. It replaces the duplicate microphone/mascot start controls. The log remains separate. Typing is collapsed behind Type instead; selecting it ends the active voice session and opens the text input directly. Back to handout minimizes the panel while the voice session continues, so the student can inspect the PDF and its citations without restarting. Ending voice remains an explicit action on the primary button. The panel is smaller, leaving more of the handout in view.

An awake mascot variant replaces the sleeping pose during a conversation. Its halo, small waveform and movement follow the voice engine’s actual phase: listening, thinking or speaking. Motion honors prefers-reduced-motion. This is phase-based animation, not audio-level lip synchronization. The generated asset and its full prompt are documented in public/sable/ASSETS.md.
