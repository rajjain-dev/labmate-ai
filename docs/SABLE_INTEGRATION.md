# Sable frontend integration

The human requested the frontend in `sable-source.zip` and the existing voice agent inside Sable’s button. The exported Lovable project was extracted alongside the repository as the design reference. Its tabletop, supplied bitmap assets, typography, mascot, paper stack, manual controls, log and microphone are now used by the existing Next.js app. The original archive remains intact.

`app/page.tsx` renders the Sable frontend. `components/sable/SafetyManual.tsx` handles the manual, and `SableAsk.tsx` presents the existing `VoiceCoach` engine through Sable’s microphone and mascot. `VoiceCoach` gained an optional render callback; its audio capture, pause detection, provider requests, playback and cancellation remain shared. Sable talks through the existing `/api/lab`, `/api/conversation`, `/api/transcribe` and `/api/speech` routes. No Lovable gateway key is required. The conversation system identifies itself as SABLE; existing ElevenLabs voice configuration is preserved.

Uploading a handout starts the conversation automatically. The upload gesture unlocks an AudioContext before the file picker, and the voice engine adopts it after extraction. Sable says “Let’s go over some key safety things first,” reads source-verified precautions and warnings, gives the key points, then invites questions. Missing safety notes are explicitly identified with a direction to the TA. Microphone access is requested after the spoken opening; the browser still controls its permission prompt. Talk/End ends or resumes the conversation. The log includes optional typing and opens the supporting handout page. Voice and history remain mounted across page changes. Dismissing the manual stops audio and pending requests. Uploading a new handout starts fresh history. No app consent checkbox or transcript-confirmation gate was added.

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

Verification of the polish on code e0528e3: production build/TypeScript and standalone packaging passed. In a separate browser demo, a synthetic two-page handout uploaded and rendered; optional typing produced a fresh live answer, the page-2 precaution link opened page 2, and reopening the log retained the answer. The awake mascot and smaller panel rendered correctly. No test suite or full microphone-loop pass is claimed. The existing user voice session was left untouched during the demo checks.

The upload action now sits directly below the introduction, above the mascot. The landing screen fits the viewport; the document and conversation scroll internally. Controls have minimum 44-pixel targets, conversation text is 16 pixels, and secondary text is generally 12–14 pixels. The desktop layout places chat alongside the PDF; narrow layouts use a wrapped header and overlay panel. PDF rendering adjusts pixel density to the visible width and zoom within the existing 2,000-pixel bound. The exact final code and checks are recorded in coordination/status/D.json.

Recommended public demo handout: the American Chemical Society’s eight-page [Does Temperature Affect Dissolving? lesson plan](https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-5/lesson-6/ch5-l6-lesson-plan.pdf), verified as a text PDF with a safety note on page 1. It is linked rather than bundled.

Final verification on code 88a289ac797f9320028a1bdb0a5cdd3056b48ab4: production build and TypeScript passed. The landing page had no document overflow at 1280×720, 390×844 and 320×568. Visible phone document controls measured at least 44×44 pixels; upload was 57 pixels high on desktop. Zoom changed 100% → 150% → 100%, and Next page opened page 2. Upload automatically opened the live briefing, with Safety notes and warnings before Key points; the demo was stopped without completing a human microphone trial. A final fresh synthetic PDF/brief/speech request returned HTTP 200 on all three routes: three grounded safety quotes, zero repeated quote lines in the overview, and 633,251 bytes of MP3. Test suites were skipped at the human’s request. The final Sable app was opened for the human on port 3108.

## Final delivery: preparation turns and web references

The human subsequently requested an immediate greeting, general preparation one item per reply, then the experiment briefing; typed replies now use a visible End turn button. A fixed greeting from the approved ElevenLabs voice plays without waiting for research. Four ACS-based reminders are handled by the same in-memory preparation index for voice and typing. Negative responses wait, explicit acknowledgments/not-applicable/skip advance one item, and questions return to the same item after guidance. Incident/scope reports reach the server policy before acknowledgment handling. Stopping/resuming voice retains the item; replacing the handout resets it. Type instead stops voice and preserves the sequence. This is a reminder based on self-report, not PPE certification or approval to begin.

Web research uses the configured xAI model's native web_search tool with five trusted domain roots. It sends fixed public topic labels, not uploaded passages, filenames or raw student turns, to search. Exact short excerpts must be found in bounded, independently fetched HTML/plain-text pages. The main answer call still receives the handout and recent turns. Excerpts have separate labels/links; concentration/condition differences remain visible. Lookup failure is disclosed and falls back to the handout. Emergency/scope routing precedes search. The feature is enabled in the ignored local configuration, disabled by default in .env.example. C004/C005 record direct human direction, not inferred peer ACKs.

Verification on application code c6c3e89:

- npm run build PASS, including TypeScript, static generation and standalone packaging. Automated suites SKIPPED at the human's request.
- A fresh synthetic handout with no safety section returned HTTP 200 in 6,535 ms, researchStatus=used, with three source excerpts independently verified from RSC and CDC. RSC concentration/eye-protection context and the CDC source URL were retained. No web passage was assigned a PDF page.
- The new fixed first greeting was generated through the live speech route: HTTP 200, 230,756 MP3 bytes. Browser upload immediately showed preparation item 1 and the Speaking to you phase, before any briefing/research request.
- In a separate synthetic browser journey, Type instead retained item 1; End turn with “not yet” stayed on item 1. “yes,” “done,” and “yes” advanced separately to items 2, 3 and 4. “ready” then opened the briefing with RSC/CDC links before Key points. No full human microphone-loop pass is claimed.
- The README now describes the final Sable product, setup, architecture, data boundaries, demo handout and remaining limitations. The final integration hash is recorded in D's release status.
