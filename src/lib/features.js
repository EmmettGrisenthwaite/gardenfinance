// Bank linking is built and tested end to end, but Plaid gates production
// access behind its own review — an application, a security questionnaire, and
// a contract. Until that clears, the entry point can only show one of two bad
// things to every new user, because onboarding routes straight to the account
// sheet where it lives:
//
//   - no server keys  → a dev-facing "an admin needs to add Plaid API keys"
//   - sandbox keys    → a bank login that only accepts fake credentials
//
// Neither belongs in front of a Play reviewer on a finance app. The app ships
// with manual entry, which is the path the money engine was built around
// anyway.
//
// This is deliberately a runtime flag rather than deleted code. The Android
// app is a Trusted Web Activity, so it renders live web content: setting
// VITE_ENABLE_BANK_LINKING=true and pushing to main turns the feature on for
// everyone who has already installed the app — no new bundle, no Play release,
// no re-review.
export const BANK_LINKING_ENABLED = import.meta.env.VITE_ENABLE_BANK_LINKING === 'true'
