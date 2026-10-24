import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingIncludes: { "/api/speech": ["./data/voice/fixture-notice.mp3"], "/api/lab": ["./scripts/extract-lab-pdf.mjs", "./node_modules/unpdf/**/*"] },
};

export default config;
