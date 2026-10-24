# Deployment handoff

Owner: D. No deployment host or public release has been configured. The scaffold builds as a Next.js standalone Node application on Node 24.

For a platform supporting Next.js, use the committed Node version, `npm ci`, and `npm run build`. Configure server-only values from `.env.example` through the host's secret settings. Set `APP_ORIGIN` to the exact public HTTPS origin when behind a proxy. Leave voice and vision disabled on public/serverless instances until the required controls and live checks are complete. `APP_MODE=fixture` is explicit; missing credentials never switch a live request to fixture output.

For a standalone Node host, `npm run build` also runs `scripts/prepare-standalone.mjs` to copy static assets and any `public/` assets into `.next/standalone/`. It removes traced local `.env` files from the output, leaving the original ignored files untouched. Supply runtime secrets through the host environment. Run the generated `server.js` with Node 24, or use `npm start` locally. The voice fixture notice is included through `outputFileTracingIncludes`; check it in the assembled package before deployment.

Deploy only the recorded passing main commit after A/B/C/D's integration gates. Verify the deployed review, citation, emergency, provider-failure and consented voice journeys on that same commit. Record the deployment URL, commit, real provider modes and actual check results in `docs/STATUS.md`. A successful build alone does not meet those gates.
