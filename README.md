# Family Meal Splitter 🍽️

A private, mobile-friendly dinner bill splitter built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style Radix/CVA UI primitives, and Lucide icons. No accounts, database, API, or analytics.

## Run locally

Requires Node.js 20.9+ (Node.js 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Start with a clean bill or choose **Load Example Dinner**. Enter the complete total including tax and tip, add households and adults, then add optional children. Each child's slider is independent. Age defaults are suggestions; customized percentages survive age changes until **Reset to age default** is selected. Results and the copy-ready message update immediately. A zero-adult household is supported.

The ordinary saved dinner persists in this browser’s localStorage. Local working copies use a separate sessionStorage record for this tab. Private browsing, browser storage policies, or clearing site data may prevent persistence. Names and bill data are never sent to an analytics service. Clipboard copying requires HTTPS or localhost and browser permission; the preview can also be selected and copied manually. Reset and example replacement ask for confirmation when existing data would be replaced.

## Share a configured dinner

Give your bill a **Dinner title**, configure the households and portions, then choose **Share dinner**. The privacy dialog defaults to children's initials; **Keep names as entered** is optional. Both modes retain ages. Household names and the dinner title remain unchanged. The choice changes only the outgoing snapshot, never your names in the editor.

The copied link contains a fixed, read-only snapshot in its URL fragment. There is no shared server record: old links always show their encoded original. A recipient selects **Edit a copy** to create an editable local session and uses **Share changes** to send a revised snapshot back. Names omitted by an initials-only link cannot be recovered. Ages remain excluded from the generated group text.

Three addresses keep these modes separate:

- The base app URL opens your ordinary saved dinner. **Reset saved dinner** clears only that dinner after confirmation.
- A `#share=v1.…` link always opens its original snapshot read-only. Titles, totals, names, ages, portions, adults, and message tone cannot change under that address.
- **Edit a copy** opens `?draft=<UUID>` in the same tab without a shared fragment. This opaque identifier only selects the matching local record in this tab; it is not a public dinner ID, authentication credential, or server lookup. Copying this address does not transfer the dinner.

One active local working copy is stored per tab, with separate starting values and current edits. Refresh restores the matching copy while its page-session storage remains available. **Reset changes** restores all starting values after confirmation and keeps the same address. **Load Example Dinner** changes current values only. **Start new dinner** creates a different blank local copy and never clears your ordinary saved dinner; replacing an edited active copy asks for confirmation even when you are viewing a snapshot or your saved dinner.

**View original snapshot**, browser Back/Forward, and **Open my saved dinner** preserve a stored working copy. **Share changes** always opens the privacy dialog with initials selected, exports current values to a portable fragment link without a draft query, and leaves your working address and original snapshot unchanged. Identical serialized snapshots can produce identical links.

Session storage is not a durable saved-dinner library. Browsers may restore page sessions after closing or copy their initial state into duplicated/opener-created tabs; subsequent tab edits are independent. Missing, corrupt, mismatched, or unavailable local records show an unavailable-copy message with recovery actions and never reveal another copy. Storage failures preserve existing stored bytes, warn about unsaved edits, and permit in-memory editing; leaving may lose those edits. Browser-close warnings are best effort.

Older shared-link overrides never replace the original. If a validated legacy record matches the original snapshot’s digest, **Recover previous edits as a local copy** explicitly creates a new session with those edits and the original reset baseline. Legacy bytes remain untouched. Ordinary saved dinners without a title still migrate to the default without losing other values.

Anyone with a link can read or change its contents. Encoding is not encryption or proof of identity. Links can remain in browser history and messages and cannot be individually revoked. Local storage is unencrypted; all projects under the same `derrick-tao.github.io` origin share access to it. Initials do not guarantee anonymity.

## Sharing security

See [the snapshot/session requirements](docs/snapshot-session-requirements.md) and [the sharing/security baseline](docs/sharing-requirements.md). Version 1 has one `#share=v1.<unpadded-base64url>` payload containing uncompressed UTF-8 JSON. It accepts only the documented version, object fields, numeric ranges, and name/ID types. It rejects noncanonical encoding, invalid UTF-8, unknown/prototype-related keys, unexpected nesting, controls and explicit bidi controls, and malformed data without overwriting drafts. Normal multilingual letters, emoji, combining marks, apostrophes, and hyphens remain supported. Names and titles render as React text and never become HTML, CSS, scripts, or navigation destinations. Shared identifiers are regenerated without names.

Sharing limits are 8,000 URL characters, 256 KiB decoded bytes (the URL limit yields a much smaller effective v1 payload), 200 households plus children, depth eight, and 120 Unicode characters per name/title. Each local record has a 1 MiB serialized limit, including both baseline and current values in a working copy; incomplete amount input may still be restored and edited. Oversized/invalid links and failed storage writes preserve existing data. No dinner details are logged, analyzed, shortened externally, or sent to an application backend.

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

Playwright starts the production server automatically after a build. Tests cover both desktop Chrome and a narrow Pixel 7 viewport, clipboard equality, persistence, independent sliders, example values, reset confirmation, and overflow. Screenshots are written to `test-results/`. On a fresh Linux machine, use `npx playwright install --with-deps chromium` if OS browser dependencies are missing.

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
- `lib/sessions.ts`: strict local pointer grammar, versioned session records, baseline/source validation, and trusted address construction.
- `hooks/use-dinner.ts`: separate read-only snapshots, ordinary saved dinners, per-tab working copies, and guarded navigation/recovery.
- `scripts/static-csp.mjs`: build-time CSP hashing and insertion for static Pages.
- `components/meal-splitter.tsx`: responsive editor, dashboard, localStorage, confirmations, and clipboard flow.
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

The normal `npm run build` and `npm run start` commands continue to support Next.js hosting at the site root, including Vercel. Bill data is stored per browser origin, so bills entered on the temporary tunnel do not automatically appear on the GitHub Pages domain.

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
