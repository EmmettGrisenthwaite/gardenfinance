# Shipping Garden Financial to Google Play

The app is a web app, so it ships as a **Trusted Web Activity** — an Android
package whose window is Chrome rendering `garden-financial.vercel.app`, with no
browser chrome. One codebase, and a Play listing.

Everything Play checks that lives in this repo is done. What remains needs a
signing key password and a Play account, which are yours.

---

## What is already in place

| Requirement | Where |
|---|---|
| Installable manifest (`name`, `id`, `start_url`, `standalone`, `theme_color`) | `public/manifest.webmanifest` |
| Icons at 192, 512, and a 512 maskable | `public/icon-*.png` |
| **Offline support** — no browser error when the network drops | `public/sw.js` |
| Domain ownership proof | `public/.well-known/assetlinks.json` |
| HTTPS | Vercel |
| SPA deep links (`/plan`, `/advisor`) resolve | `vercel.json` rewrite |

The service worker is the one Play rejects builds over. It serves the cached
shell on a failed navigation, so the app opens to a login screen rather than a
dinosaur. It caches **only** the shell and hashed assets — never a Supabase
response, because stale balances are worse than absent ones.

---

## The build runs outside OneDrive — this is not optional

This repo lives under `C:\Users\emmet\OneDrive\...`. OneDrive Files On-Demand
turns synced files into **cloud placeholders**, which Windows reports as reparse
points rather than regular files. Gradle snapshots the whole `app/res` tree
before it compiles, and a placeholder is not a file it can hash, so the build
dies with:

```
Cannot snapshot ...\ic_notification_icon.png: not a regular file
```

The filename in that error is meaningless — it is whichever placeholder Gradle
reached first. Pinning the folder does not reliably fix it, because OneDrive can
dehydrate files again mid-build.

So the Android project lives at **`C:\Users\emmet\garden-twa`**, outside the
sync root. Nothing is lost by this: the entire project is regenerated from
`twa-manifest.json`, and `/app/`, `/gradle/`, `gradlew*` and `*.aab` are all
gitignored anyway. Only `twa-manifest.json` is tracked.

The signing keystore exists in two places on purpose:

- `C:\Users\emmet\garden-twa\android.keystore` — what the build reads.
- The copy under OneDrive — the offsite backup, synced to the cloud.

**Back it up somewhere you will still have in two years.** Losing it means you
can never update the listing, only publish a new app under a new name.

---

## 1. Build the Android package

```bash
cd C:\Users\emmet\garden-twa
```

```bash
npx @bubblewrap/cli build
```

It prompts for the keystore password, then the key password. Output is
`app/build/outputs/bundle/release/app-release-bundle.aab` — signed, and what
Play wants.

Gradle alone produces an **unsigned** bundle; Bubblewrap runs jarsigner
afterward. So `gradlew bundleRelease` is a fine way to check the project
compiles without touching a password, but its output cannot be uploaded.

Current identity, which must not drift:

| Field | Value |
|---|---|
| `packageId` | `app.gardenfinancial.twa` |
| `appVersionName` | `1.0.0` |
| `appVersionCode` | `2` |

`versionCode` must increase on **every** upload — Play rejects a bundle whose
code it has already seen. `versionName` is the string users read; bump it only
when the app meaningfully changes.

If you edit `twa-manifest.json` by hand, `manifest-checksum.txt` no longer
matches and Bubblewrap will offer to re-run `update`, which bumps the version
again. Either accept that, or recompute the checksum:

```bash
node -e "const f=require('fs'),c=require('crypto');f.writeFileSync('manifest-checksum.txt',c.createHash('sha1').update(f.readFileSync('twa-manifest.json')).digest('hex'))"
```

## 2. Prove you own the domain

Without this the app opens with a URL bar across the top, which looks broken.

`public/.well-known/assetlinks.json` is already written with the **upload key**
fingerprint:

```
92:C3:3F:A2:6D:9C:08:8A:5F:0F:75:E9:07:AF:07:12:4F:B2:38:32:E6:18:B6:A1:AC:5C:B0:0B:42:37:E4:AA
```

Confirm it is actually served — `vercel.json` rewrites `/(.*)` to the SPA, but
Vercel checks the filesystem first, so a real file wins:

```bash
curl https://garden-financial.vercel.app/.well-known/assetlinks.json
```

### You are not done here

Play App Signing is **mandatory for new apps**, and it means Google re-signs the
app with *its own* key before it reaches a device. Your upload key never touches
the installed app. So the fingerprint above verifies a sideloaded APK and
**nothing on the Play Store** — the URL bar will appear in production until you
fix this.

After the first upload, go to *Play Console → Test and release → Setup → App
integrity → App signing key certificate*, copy the SHA-256, and add it to the
array:

```json
"sha256_cert_fingerprints": [
  "92:C3:...:AA",
  "THE:PLAY:APP:SIGNING:SHA256"
]
```

Keep both. The first keeps local sideload testing working; the second is what
real users need. Redeploy, then re-run the `curl` above.

## 3. The listing

Play needs assets this repo cannot generate:

- **Screenshots** — at least two phone shots, 1080×1920. The Plan and the
  Advisor are the two screens worth showing.
- **Feature graphic** — 1024×500.
- **Privacy policy URL** — `https://garden-financial.vercel.app/privacy`, which
  is a public route and resolves without signing in. Required for everything,
  and non-negotiable for a finance app.
- **Data safety form.** Declare financial info collected, encrypted in transit,
  and user-deletable — Settings already exports and deletes account data.

## 4. Before you submit

- [ ] Install the AAB on a real device and confirm **no URL bar** — if one
      appears, `assetlinks.json` is not verifying. Check the Play App Signing
      fingerprint first; that is the usual cause.
- [ ] Turn on airplane mode and reopen. Should show the app, not an error.
- [ ] Sign in, complete onboarding, add the plan to Plan, mark a step done.
- [ ] Rotate the device — the app is `portrait` in the manifest, so it should
      hold portrait.
- [ ] Press back from Home. TWAs exit rather than showing a blank page.

## Updating later

The web app updates on every push to `main` — a TWA loads live content, so users
get changes without a Play release. You only need to ship a new AAB when the
package itself changes: name, icon, target SDK, or the Bubblewrap config.
