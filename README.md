# Family Meal Splitter 🍽️

A private, mobile-friendly dinner bill splitter built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style Radix/CVA UI primitives, and Lucide icons. No accounts, database, API, or analytics.

## Run locally

Requires Node.js 20.9+ (Node.js 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Start with a clean bill or choose **Load Example Dinner**. Enter the complete total including tax and tip, add households and adults, then add optional children. Each child's slider is independent. Age defaults are suggestions; customized percentages survive age changes until **Reset to age default** is selected. Results and the copy-ready message update immediately. A zero-adult household is supported.

The bill and tone persist only in this browser's localStorage. Private browsing, browser storage policies, or clearing site data may prevent persistence. Names and bill data are never sent to an analytics service. Clipboard copying requires HTTPS or localhost and browser permission; the preview can also be selected and copied manually. Reset and example replacement ask for confirmation when existing data would be replaced.

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

## Calculation and code structure

- `lib/meal.ts`: types, age defaults, state validation, pure child update helpers, USD input parsing, exact cent allocation, example fixture, and message generation.
- `components/meal-splitter.tsx`: responsive editor, dashboard, localStorage, confirmations, and clipboard flow.
- `components/ui/`: local, editable shadcn-style button and input primitives.
- `app/globals.css`: Tailwind integration and responsive visual styles.
- `tests/meal.test.ts`: calculation, message, input validation, and persisted-state unit tests.
- `e2e/meal.spec.ts`: complete desktop and mobile browser flows.

Weights are nonnegative integer percentage points: each adult contributes 100, each child their chosen 0–100 percentage in steps of 5. The amount is parsed directly into cents. BigInt multiplication and division preserve exact quotients and remainders. Floor each household's allocation, then award leftover pennies in descending remainder order; household order breaks ties. Payments sum to the bill exactly. A nonzero bill with zero combined weight displays a validation message and disables copying.

The fictional $254.74 example produces Family A $62.67, Family B $40.44, Family C $90.98, and Family D $60.65. Changing Child A2 from 30% to 50% gives $68.58, $39.19, $88.18, and $58.79 respectively.

USD inputs accept nonnegative decimal amounts with at most two fractional digits, up to $999,999,999.99. Invalid text is preserved while editing and flagged; calculations and copying pause until corrected. Empty input is treated as zero. Adults range from 0 to 1,000 per household; ages may be blank or 0–17. Unnamed entries receive neutral display fallbacks. Only fictional Family A–D and Child A1–D2 appear in supplied fixtures.

## Verification

Validated in the implementation environment: 23 unit tests and four Playwright flows (two each on desktop and mobile), formatting, ESLint, TypeScript, and a production build. The build uses Webpack because the managed environment restricts Turbopack’s internal port binding. Next.js is configured to use the TypeScript compiler API with TypeScript 5.

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
