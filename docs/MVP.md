# Sable MVP

The final product description and setup instructions are in [README.md](../README.md). The primary flow is selectable-text handout upload → immediate greeting → one preparation item per reply → experiment precautions and key points → ongoing questions. Typing is optional and submits with End turn. No app checkbox, grading screen, or transcript-confirmation gate is required.

Use Node 24 and the server-only settings in .env.example. Development loads .env.local automatically. For local standalone operation run npm run build, then `HOSTNAME=127.0.0.1 PORT=3108 node --env-file=.env.local .next/standalone/server.js`. The standalone package excludes environment files. Keep credentials out of Git.

The PDF bound is 5 MiB / 25 pages / 24,000 extracted characters, with an eight-second extraction worker deadline and bounded worker memory. No OCR is included. TXT/MD files use the same text bound. Handouts and history stay in the browser's current memory; the app does not save the PDF. xAI receives the handout and recent turns for answers. ElevenLabs receives voice audio/text. No provider retention claim is made.

The preparation sequence is general ACS-based guidance, linked in lib/lab/preparation.ts. Replies are self-reports, not PPE verification or approval to begin. Exact PDF precaution quotes are checked against their cited pages. Optional ENABLE_WEB_RESEARCH uses xAI native web search with public topic labels and independently verified source excerpts from five trusted domain roots; it never assigns web text a handout page. Failed/unverified web lookup is disclosed and falls back to the handout. Search uses up to two agent turns, an 18-second deadline, and a bounded ten-minute public-topic cache. Normal conversation has a 35-second deadline. Search and answer calls share the model-attempt allowance; native tools may have additional provider charges.

Voice waits for the first preparation reply after the greeting. A 2.2-second pause ends a spoken turn, and recording is bounded to 29 seconds / 5 MiB. End conversation, “stop listening,” or leaving the foreground ends voice. Barge-in is not implemented. Type instead stops voice while retaining the current preparation item and conversation. Emergency reports reach fixed escalation guidance before research and end voice after the response.

Current operation supports a supervised single Node process with bounded concurrency, 20 voice calls/minute and configurable hard paid-attempt caps. Process restarts reset in-memory allowances. Public/serverless live deployment requires shared limits. Provider dashboard spend limits should match the demo budget.

The prior text-review endpoint and local NIST source pack remain for compatibility. Snowflake and camera are excluded. Exact code and actual build/live/browser evidence are recorded in docs/STATUS.md and coordination/status/D.json. Test suites remain skipped at the human's request; no full human microphone pass is claimed.
