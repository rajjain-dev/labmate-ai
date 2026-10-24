# Source manifest

Sources are chosen on the server, never by this skill. The app returns at most five passages from the approved pack for the selected context (`intro-chem-demo`), each with `sourceId`, `documentId`, `title`, `locator`, `url` (HTTPS allowlisted or null), `sourceKind`, `version` and `reviewedOn`.

- Live retrieval: Snowflake Cortex Search over the approved pack (`meta.retrieval: "snowflake"`).
- Fallback: the same pack from the local corpus, disclosed as `meta.retrieval: "local"` with a warning.
- Fixture mode: canned reviews whose sources, if any, are labeled `FIXTURE ONLY` placeholders, not real documents.

Permissions, licenses and redistribution status for each document are recorded by the evidence owner (role C) in `data/SOURCE_LICENSES.md`, with passages in `data/corpus.json`. Those files are maintained on C's branch and are not part of this skill. Do not quote more of a source than the returned excerpt, and do not treat a source as applicable beyond its stated context, product or concentration.
