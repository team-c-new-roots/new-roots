/// <reference types="vite/client" />

interface ImportMetaEnv {
  // where answers are posted once the scoring API is live, like /api/score.
  // leave it unset to use the saved example in public/data
  readonly VITE_RESULTS_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
