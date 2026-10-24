# Voice fixture

`fixture-notice.mp3` is a synthetic local announcement made for this project with macOS `say` and encoded using FFmpeg. It contains no student recording or provider output. Script: “This is fixture audio. Live speech is unavailable. Read the visible review.”

Fixture speech always plays this announcement, never pretends to read the submitted review, and returns `X-LabMate-Mode: fixture`. It is not evidence of an ElevenLabs integration. The small silent files in `tests/integration/media/` were generated using FFmpeg for container validation tests.
