# LabMate AI starter repository

This repository contains the four teammate implementation handoff, role prompts and agent coordination helper. The application has not been scaffolded yet.

Start with [START_HERE.md](START_HERE.md), then [the full implementation plan](docs/LABMATE_HANDOFF.md) and [your agent prompt](prompts/). D owns the common app scaffold and integration; B publishes shared contracts before consumers integrate.

The coordination instructions are in [coordination/PROTOCOL.md](coordination/PROTOCOL.md). The helper uses explicit Git commits, pushes and fetches. It does not automatically start or wake agents.

Use [the brainstorming document](https://docs.google.com/document/d/1AMvxv77HPJAQLYSiyqJ5wJy7uwNaCfJgkGu4mq4u-dM/edit?usp=sharing) for tentative ideas. Record accepted changes and agent status in the repository.

There is no package.json yet. Do not run npm ci or npm run dev until the application scaffold is committed. The communication helper requires Node and Git only. No provider credentials are included.
