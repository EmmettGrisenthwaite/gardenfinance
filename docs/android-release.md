# Shipping Garden Financial to Google Play

The app is a web app, so it ships as a **Trusted Web Activity** — an Android
package whose window is Chrome rendering `garden-financial.vercel.app`, with no
browser chrome. One codebase, and a Play listing.

Everything Play checks that lives in this repo is done. What remains needs a
signing key and a Play account, which are yours.

---

## What is already in place

| Requirement | Where |
|---|---|
| Installable manifest (`name`, `id`, `start_url`, `standalone`, `theme_color`) | `public/manifest.webmanifest` |
| Icons at 192, 512, and a 512 maskable | `public/icon-*.png` |
| **Offline support** — no browser error when the network drops | `public/sw.js` |
| HTTPS | Vercel |
| SPA deep links (`/plan`, `/advisor`) resolve | `vercel.json` rewrite |

The service worker is the one Play rejects builds over. It serves the cached
shell on a failed navigation, so the app opens to a login screen rather than a
dinosaur. It caches **only** the shell and hashed assets — never a Supabase
response, because stale balances are worse than absent ones.

---

## 1. Build the Android package

```bash
npx @bubblewrap/cli init --manifest https://garden-financial.vercel.app/manifest.webmanifest
```

```bash
npx @bubblewrap/cli build
```

The first command asks for a package name — `app.vercel.garden_financial` or
your own reverse-domain string. It generates a signing keystore; **back that up
somewhere you will still have in two years.** Losing it means you can never
update the listing, only publish a new app.

Output is `app-release-bundle.aab`, which is what Play wants.

## 2. Prove you own the domain

Without this the app opens with a URL bar across the top, which looks broken.

```bash
npx @bubblewrap/cli fingerprint list
```

Take the SHA-256 and create `public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "YOUR.PACKAGE.NAME",
    "sha256_cert_fingerprints": ["YOUR:SHA:256:FINGERPRINT"]
  }
}]
```

Deploy, then confirm it is actually served:

```bash
curl https://garden-financial.vercel.app/.well-known/assetlinks.json
```

**If you use Play App Signing** (the default, and recommended), Play re-signs the
app with its own key. Take the fingerprint from *Play Console → Setup → App
integrity* instead, or add both — the file accepts an array.

## 3. The listing

Play needs assets this repo cannot generate:

- **Screenshots** — at least two phone shots, 1080×1920. The Plan and the
  Advisor are the two screens worth showing.
- **Feature graphic** — 1024×500.
- **Privacy policy URL.** Required for everything, and non-negotiable for a
  finance app. It has to state what is collected and where it lives: Supabase
  (Postgres, RLS per user) and Anthropic for advisor messages.
- **Data safety form.** Declare financial info collected, encrypted in transit,
  and user-deletable — Settings already exports and deletes account data.

## 4. Before you submit

- [ ] Install the AAB on a real device and confirm **no URL bar** — if one
      appears, `assetlinks.json` is not verifying.
- [ ] Turn on airplane mode and reopen. Should show the app, not an error.
- [ ] Sign in, complete onboarding, add the plan to Plan, mark a step done.
- [ ] Rotate the device — the app is `portrait` in the manifest, so it should
      hold portrait.
- [ ] Press back from Home. TWAs exit rather than showing a blank page.

## Updating later

The web app updates on every push to `main` — a TWA loads live content, so users
get changes without a Play release. You only need to ship a new AAB when the
package itself changes: name, icon, target SDK, or the Bubblewrap config.
