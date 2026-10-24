# LabMate AI

The private shared repository is [rajjain-dev/labmate-ai](https://github.com/rajjain-dev/labmate-ai). Teammates need collaborator access before cloning. The Next.js scaffold is available; the student review modules are being assembled. See [actual integrated status](docs/STATUS.md) before claiming a working journey.

Start with [START_HERE.md](START_HERE.md), then [the full implementation plan](docs/LABMATE_HANDOFF.md) and [your agent prompt](prompts/). D owns the common app scaffold and integration; B publishes shared contracts before consumers integrate.

The coordination instructions are in [coordination/PROTOCOL.md](coordination/PROTOCOL.md). The helper uses explicit Git commits, pushes and fetches. It does not automatically start or wake agents.

Use [the brainstorming document](https://docs.google.com/document/d/1AMvxv77HPJAQLYSiyqJ5wJy7uwNaCfJgkGu4mq4u-dM/edit?usp=sharing) for tentative ideas. Record accepted changes and agent status in the repository.

Use Node 24 (`nvm install && nvm use`), then `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Run `npm run typecheck`, `npm test`, and `npm run build` before offering a slice. Dependencies are pinned in the lockfile. No provider credentials are included.

Default mode is explicitly `fixture`; it never proves live sponsor integration. Voice is disabled by default. B owns schemas and review/health routes; A owns the student page; C owns approved evidence; D owns voice and assembly. C001 remains pending until the required explicit acknowledgments are recorded.
