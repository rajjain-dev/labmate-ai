# Start working on LabMate AI

The handoff describes the project; the coordination kit provides development instructions and a communication helper. Neither contains a finished LabMate app. A local starter repository is available in the labmate-ai folder alongside this guide. A shared GitHub URL must be created or supplied before the four agents can exchange updates across computers.

## Share the handoff now

1. Download LabMate_AI_Four_Person_Pack.zip from this chat.
2. Send the downloaded ZIP as a file attachment through your usual team chat, email or shared drive. A local file link from this chat is not a public download link your friend can use.
3. Agree which teammate owns A, B, C and D. Give each person a different role.
4. Your friend extracts the ZIP, reads README.md, then opens the coordination-kit folder in their coding workspace. The full specification is docs/LABMATE_HANDOFF.md. The matching startup instruction is prompts/A.md, B.md, C.md or D.md.
5. Until a shared remote and common scaffold exist, work on independent preparation and report progress through the brainstorming document or team chat. Do not pretend the Git helper is connected or that the app is runnable.

## What each teammate can start immediately

- A: Read the request and response contracts, sketch the form and results, and prepare the demo story.
- B: Define the executable shared schemas, provider signatures and response fixtures. Publish them on the common scaffold before consumers integrate.
- C: Review permitted source documents, prepare stable passages and source permissions, and verify Snowflake access.
- D: Establish the common application scaffold, shared repository, configuration and voice provider access, then publish the baseline for the other three.

The fourth person is the integration owner, not the person who rewrites everyone else's module. Owners fix their own integration failures.

## Once the shared GitHub repository exists

The repository owner shares its actual URL and gives all four teammates access. For a private repository, friends must accept their collaborator invitations before cloning. Credentials stay in each person's local environment; never put keys in the repository or brainstorming document.

Each teammate clones the same repository into their own folder, creates their assigned branch from the agreed main baseline, and starts the corresponding role prompt. Use one clone per laptop or one worktree per agent. The roster names are:

| Role | Branch |
| --- | --- |
| A | feat/student-ui |
| B | feat/review-harness |
| C | feat/evidence |
| D | feat/voice-integration |

Use the actual repository URL in the clone command; no working GitHub URL is implied by this guide. If D has already published your role branch, check out that branch instead of creating a competing one.

After cloning and selecting your branch, read AGENTS.md and docs/LABMATE_HANDOFF.md, then run the coordination read command with your own ID. Missing peer branches mean those owners have not published yet; they are not evidence of completed work. Follow coordination/PROTOCOL.md to commit and push your own progress and messages. D merges tested slices into main and verifies the assembled and deployed build.

There is no package.json or runnable application in this starter yet. Do not run npm ci or npm run dev until D has published the application scaffold and lockfile. The coordination helper itself needs only Node and Git.

## Starter message for your friend

I sent you the LabMate AI team pack. Your role is [A, B, C or D — choose one before sending]. Extract it and read README.md, then coordination-kit/docs/LABMATE_HANDOFF.md and your matching file in coordination-kit/prompts/. Start with the independent preparation listed in START_HERE.md while we establish the shared repository and application scaffold. Once I send the GitHub URL and access is ready, clone that repository and continue on your assigned branch. Our Google Doc is for brainstorming; accepted build changes and agent status go into the repository.
