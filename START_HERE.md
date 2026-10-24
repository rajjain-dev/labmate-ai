# Start working on LabMate AI

The shared repository is [rajjain-dev/labmate-ai](https://github.com/rajjain-dev/labmate-ai). It is private. The handoff describes the project; the coordination kit provides development instructions and a communication helper. The LabMate application has not been built yet.

## Share the handoff now

1. Download LabMate_AI_Four_Person_Pack.zip from this chat.
2. Send the downloaded ZIP as a file attachment through your usual team chat, email or shared drive. A local file link from this chat is not a public download link your friend can use.
3. Agree which teammate owns A, B, C and D. Give each person a different role.
4. Your friend extracts the ZIP, reads README.md, then opens the coordination-kit folder in their coding workspace. The full specification is docs/LABMATE_HANDOFF.md. The matching startup instruction is prompts/A.md, B.md, C.md or D.md.
5. For coding and agent communication, use the shared repository rather than separate unconnected copies of the ZIP. The ZIP remains useful for reading the handoff. Until the common application scaffold exists, start the independent preparation below and keep application readiness claims accurate.

## What each teammate can start immediately

- A: Read the request and response contracts, sketch the form and results, and prepare the demo story.
- B: Define the executable shared schemas, provider signatures and response fixtures. Publish them on the common scaffold before consumers integrate.
- C: Review permitted source documents, prepare stable passages and source permissions, and verify Snowflake access.
- D: Establish the common application scaffold, shared repository, configuration and voice provider access, then publish the baseline for the other three.

The fourth person is the integration owner, not the person who rewrites everyone else's module. Owners fix their own integration failures.

## Join the shared GitHub repository

The owner invites each teammate with write access. Friends must accept their collaborator invitations before cloning this private repository. Send the owner your GitHub username; sharing the URL alone does not grant access. Credentials stay in each person's local environment; never put keys in the repository or brainstorming document.

Each teammate clones the repository into their own folder, checks out their assigned branch, and starts the corresponding role prompt. Use one clone per laptop or one worktree per agent. The four initial branches are published from the same starter baseline. The roster names are:

| Role | Branch |
| --- | --- |
| A | feat/student-ui |
| B | feat/review-harness |
| C | feat/evidence |
| D | feat/voice-integration |

For example, after accepting the invite, teammate A runs:

```sh
git clone https://github.com/rajjain-dev/labmate-ai.git
cd labmate-ai
git switch feat/student-ui
node scripts/coord.mjs read --id A --fetch
```

Use the matching branch and ID for B, C or D. A current supported Node LTS and Git are required. The communication helper needs no npm install. Open this cloned project folder in your coding workspace and paste the matching file from prompts/ into the agent.

After cloning and selecting your branch, read AGENTS.md and docs/LABMATE_HANDOFF.md, then run the coordination read command with your own ID. Missing peer branches mean those owners have not published yet; they are not evidence of completed work. Follow coordination/PROTOCOL.md to commit and push your own progress and messages. D merges tested slices into main and verifies the assembled and deployed build.

There is no package.json or runnable application in this starter yet. Do not run npm ci or npm run dev until D has published the application scaffold and lockfile. The coordination helper itself needs only Node and Git.

## Starter message for your friend

Our private repository is https://github.com/rajjain-dev/labmate-ai. Send me your GitHub username so I can invite you. Your role is [A, B, C or D — choose one before sending]. After accepting the invite, clone the repo, open START_HERE.md, and paste your matching prompts/ file into your coding agent. The full plan is docs/LABMATE_HANDOFF.md. You can start independent preparation immediately; D publishes the common application scaffold before the modules integrate. Our Google Doc is for brainstorming; accepted build changes and agent status go into the repository.
