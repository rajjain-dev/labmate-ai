# LabMate AI

Upload your lab handout, start a voice conversation, hear a brief and the handout's precautions, then ask questions out loud. LabMate listens again after each answer. Typing is optional. There are no app checkboxes or transcript-confirmation screens.

Use Node 24: npm ci, copy .env.example to .env.local, then npm run dev. For a standalone build use npm run build and provide runtime environment variables; locally, `HOSTNAME=127.0.0.1 PORT=3107 node --env-file=.env.local .next/standalone/server.js`. Never commit credentials.

Live conversation uses xAI and ElevenLabs. PDF extraction supports selectable text; uploaded precautions are quoted with page references. The application keeps the handout and conversation in the page's memory and does not save the PDF. Your course protocol and lab supervisor remain authoritative. See docs/MVP.md for setup, limits and actual verification.

The human requested skipping tests. Production compilation and targeted live requests are recorded in docs/STATUS.md; no suite pass or human microphone end-to-end pass is claimed. Public live access still needs a shared limiter. Snowflake and camera remain excluded.

Shared remote: https://github.com/rajjain-dev/labmate-ai. Role contributions and direct human delivery decisions are recorded in coordination/.
