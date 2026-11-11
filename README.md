# Family Meal Splitter 🍽️

A private, mobile-friendly dinner bill splitter built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style Radix/CVA UI primitives, and Lucide icons. No accounts, database, API, or analytics.

## Run locally

Requires Node.js 20.9+ (Node.js 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Start with a clean bill or choose **Load Example Dinner**. Enter the complete total including tax and tip, add households and adults, then add optional children. Each child's slider is independent. Age defaults are suggestions; customized percentages survive age changes until **Reset to age default** is selected. Results and the copy-ready message update immediately. A zero-adult household is supported.

Your editable bill saves automatically in this tab’s sessionStorage. Refresh restores the latest saved values. Each independent tab has its own bill; duplicated/opener-created tabs may start with a copy, then edit independently. Recovery after closing a tab or browser is not guaranteed. Keep an updated shared URL to save a version for later. Private browsing, blocked storage, or clearing site data may prevent refresh recovery. Storage failures show a warning and preserve previously saved bytes; you can keep editing in memory and Share before leaving. Names and bill data are never sent to analytics.

**New bill** replaces the current tab’s work with a blank bill after confirmation if it contains data. **Load Example Dinner** uses the same replacement protection. There is no whole-bill Reset. Child **Reset to age default** remains available.

## Share a configured dinner

Give your bill a **Dinner title**, configure the households and portions, then choose **Share**. The privacy dialog starts with children’s initials selected; **Keep names as entered** is optional. Ages remain included in both modes. Household names and the title stay unchanged. The choice transforms only the outgoing snapshot, never the editor’s names.

Two experiences keep the flow simple:

- The plain app URL opens **your bill**, editable and autosaved in this tab. The working address contains no bill data or draft pointer. Copying it does not transfer your bill.
- A `#share=v1.…` URL opens a **shared bill**, read-only and fixed to its encoded values. Viewing it preserves this tab’s editable work. **Make a copy** imports the displayed snapshot into your bill after confirmation if it replaces existing work. **Continue my bill** and the app logo return to existing work without importing the snapshot.

**Share** captures the currently displayed values without changing your working address. Share again after editing to keep the revised version: earlier links do not update. Identical serialized values may produce identical URLs. Open a saved link and choose **Make a copy** to resume editing after closing a tab. Messages remain live and copy as plain text, without children’s ages. Clipboard access needs HTTPS or localhost and browser permission; manual copying is available when blocked.

Browser Back/Forward can revisit immutable snapshots but does not resurrect an editable bill deliberately replaced by New bill. There is no bill library or cross-tab synchronization.

Earlier browser-wide saved bills, shared overrides, and version 1 tab records are read-only recovery sources. They are never automatically loaded into new tabs or deleted. When available, **Recover an earlier bill** offers explicit imports identifying their source. A matching old `?draft=` address can recover only its matching validated record in that tab. Previous shared edits are offered only when their digest matches the viewed snapshot. Recovery writes a new-format bill without changing legacy bytes. Invalid/mismatched addresses never reveal another bill.

Anyone with a shared URL can read its contents or construct a different valid snapshot. Encoding is not encryption or proof of identity. Links can remain in browser history and messages and cannot be individually revoked. Browser storage is unencrypted; projects under the same `derrick-tao.github.io` origin share origin access. Initials do not guarantee anonymity. There is no application server storing dinners.

## Sharing security

See [the approved simplified bill requirements](docs/simplified-bill-requirements.md) and [the sharing/security baseline](docs/sharing-requirements.md). The earlier [snapshot/session requirements](docs/snapshot-session-requirements.md) are superseded where they differ. Version 1 has one `#share=v1.<unpadded-base64url>` payload containing uncompressed UTF-8 JSON. It accepts only the documented version, object fields, numeric ranges, and name/ID types. It rejects noncanonical encoding, invalid UTF-8, unknown/prototype-related keys, unexpected nesting, controls and explicit bidi controls, and malformed data without overwriting drafts. Normal multilingual letters, emoji, combining marks, apostrophes, and hyphens remain supported. Names and titles render as React text and never become HTML, CSS, scripts, or navigation destinations. Shared identifiers are regenerated without names.

Sharing limits are 8,000 URL characters, 256 KiB decoded bytes (the URL limit yields a much smaller effective v1 payload), 200 households plus children, depth eight, and 120 Unicode characters per name/title. Each local record has a 1 MiB serialized limit, including its version and current bill; incomplete amount input may still be restored and edited. Oversized/invalid links and failed storage writes preserve existing data. No dinner details are logged, analyzed, shortened externally, or sent to an application backend.

The static Pages build adds an early Content Security Policy to every exported HTML page. Inline Next.js hydration scripts use exact build-generated SHA-256 hashes; scripts cannot use `unsafe-inline` or `unsafe-eval`. Numeric progress styling has a separate inline-style allowance. Meta CSP cannot set HSTS or `frame-ancestors`; no such host-level protection is claimed. Context-safe rendering and schema validation remain the primary input defenses.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production server automatically after a build. Tests cover both desktop Chrome and a narrow Pixel 7 viewport, clipboard equality, persistence, independent sliders, example values, replacement confirmations, same-browser tab isolation, recovery/failure handling, and overflow. Screenshots are written to `test-results/`. On a fresh Linux machine, use `npx playwright install --with-deps chromium` if OS browser dependencies are missing.

```sh
npm run format
npm run start
```

For browser tests against an exported Pages build, serve `out/` under the repository path (see below), then run:

```sh
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081/family-meal-splitter-web/ npm run test:e2e
```

The external-server mode tests the actual static export and its generated CSP. The default browser-test mode starts a normal Next production server.

## Calculation and code structure

- `lib/meal.ts`: types, age defaults, state validation, pure child update helpers, USD input parsing, exact cent allocation, example fixture, and message generation.
- `lib/sharing.ts` and `lib/validation.ts`: strict share codec, privacy transformation, schema reconstruction, and draft validation.
- `lib/tab-bill.ts`: strict version 2 per-tab current-bill schema and replacement detection.
- `lib/sessions.ts`: read-only legacy pointer/session validation and trusted address construction.
- `hooks/use-dinner.ts`: one per-tab editable bill, read-only snapshots, accurate persistence status, and guarded navigation/recovery.
- `scripts/static-csp.mjs`: build-time CSP hashing and insertion for static Pages.
- `components/meal-splitter.tsx`: responsive editor, dashboard, replacement/privacy confirmations, and clipboard flow.
- `components/ui/`: local, editable shadcn-style button and input primitives.
- `app/globals.css`: Tailwind integration and responsive visual styles.
- `tests/meal.test.ts`: calculation, message, input validation, and persisted-state unit tests.
- `e2e/meal.spec.ts`: complete desktop and mobile browser flows.

Weights are nonnegative integer percentage points: each adult contributes 100, each child their chosen 0–100 percentage in steps of 5. The amount is parsed directly into cents. BigInt multiplication and division preserve exact quotients and remainders. Floor each household's allocation, then award leftover pennies in descending remainder order; household order breaks ties. Payments sum to the bill exactly. A nonzero bill with zero combined weight displays a validation message and disables copying.

The fictional $254.74 example produces Family A $62.67, Family B $40.44, Family C $90.98, and Family D $60.65. Changing Child A2 from 30% to 50% gives $68.58, $39.19, $88.18, and $58.79 respectively.

USD inputs accept nonnegative decimal amounts with at most two fractional digits, up to $999,999,999.99. Invalid text is preserved while editing and flagged; calculations and copying pause until corrected. Empty input is treated as zero. Adults range from 0 to 1,000 per household; ages may be blank or 0–17. Unnamed entries receive neutral display fallbacks. Only fictional Family A–D and Child A1–D2 appear in supplied fixtures.

## Verification

Validation covers unit tests, desktop and mobile Playwright flows, formatting, ESLint, TypeScript, and production builds. The build uses Webpack because the managed environment restricts Turbopack’s internal port binding. Next.js is configured to use the TypeScript compiler API with TypeScript 5.

## GitHub Pages

Live app: https://derrick-tao.github.io/family-meal-splitter-web/

Repository: https://github.com/derrick-tao/family-meal-splitter-web

The included `.github/workflows/pages.yml` validates the source, exports a static Next.js app, and deploys it to GitHub Pages on every push to `main`. In the repository’s **Settings → Pages**, set the source to **GitHub Actions**. No credentials or database are required by the app.

To reproduce the Pages build locally:

```sh
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/family-meal-splitter-web npm run build
python3 -m http.server 8080 --directory out
```

GitHub serves `out/` at the repository subpath; local HTTP servers serve it at their root. For a local preview with the exact repository subpath, place or symlink `out/` inside a static server root as `family-meal-splitter-web/`.

The normal `npm run build` and `npm run start` commands continue to support Next.js hosting at the site root, including Vercel. Active bill data is stored per tab and origin. Use a shared snapshot URL to transfer its values; a plain app URL does not contain them.

## Deploy to Vercel

No environment variables or backend services are required.

1. Commit this project and push it to your GitHub, GitLab, or Bitbucket repository.
2. In https://vercel.com/new, import the repository.
3. Select **Next.js** as the framework; use the repository root as the root directory.
4. Keep the default install command (`npm install`), build command (`npm run build`), and output settings.
5. Click **Deploy**. Vercel supplies an HTTPS URL, which enables clipboard access on phones.
6. Open that URL on a phone, load the example, adjust a slider, and copy the message.

Alternatively, deploy from this directory using your authenticated Vercel account:

```sh
npx vercel login
npx vercel --prod
```

A live Vercel deployment requires your account connection; no credentials are included in the project. Future pushes to the connected production branch automatically redeploy.
