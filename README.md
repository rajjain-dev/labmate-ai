# SABLE

The Sable frontend from the exported Lovable app, connected to LabMate’s existing document-grounded Grok and ElevenLabs voice agent. Upload a handout: Sable automatically reads the handout’s safety notes and warnings, gives the key points, then listens for your questions. The primary button ends or resumes voice. The log also accepts optional typed questions and opens cited handout pages. There are no app checkboxes or transcript-confirmation screens.

Use Node 24: npm ci, copy .env.example to .env.local, then `npm run dev -- --hostname 127.0.0.1 --port 3108`. For a standalone build use npm run build and provide runtime environment variables; locally, `HOSTNAME=127.0.0.1 PORT=3108 node --env-file=.env.local .next/standalone/server.js`. The dev/build hooks prepare the local PDF viewer worker automatically. Never commit credentials.

Live conversation uses xAI and ElevenLabs. PDF extraction supports selectable text; TXT/MD handouts are also supported. Uploaded precautions are quoted with page references. Sable’s manual controls, zoom, and conversation log preserve the conversation across page changes. The application keeps the handout and conversation in the page’s memory and does not save the PDF. Your course protocol and lab supervisor remain authoritative. See docs/MVP.md for provider setup and limits.

The human requested skipping test suites. Sable’s production build/TypeScript compilation, browser PDF rendering, live typed conversation, cited-page navigation, retained history, and live speech output were checked. A full human microphone conversation still needs a browser trial. See docs/SABLE_INTEGRATION.md for the verification record. Public live access still needs a shared limiter. Snowflake and camera remain excluded.

Shared remote: https://github.com/rajjain-dev/labmate-ai. Role contributions and direct human delivery decisions are recorded in coordination/.
