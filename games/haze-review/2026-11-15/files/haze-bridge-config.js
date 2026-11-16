// Operator-owned configuration. Never populate this from an embed query or ref.
// Local QA origins belong in a separate test configuration, not this allowlist.
export const HAZE_AUTH_ALLOWED_ORIGINS = Object.freeze([
  'https://tokenprinter.fun',
  'https://tokenprinter-lagoon.mlewis412.chatgpt.site',
  'https://pepecoinhub.com',
]);
