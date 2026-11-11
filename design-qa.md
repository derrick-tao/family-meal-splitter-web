# Bill-first entry design QA

Evidence directory: `/workspace/artifacts/bill-first-verification/`. Relative evidence filenames below resolve there. Rendered implementation screenshot: `/workspace/artifacts/bill-first-verification/entry-390.png`. Full combined comparison: `/workspace/artifacts/bill-first-verification/comparison-full.png`.

**Findings**

- [Resolved P2] New entry supporting text initially did not meet 4.5:1 normal-text contrast. Computed Chromium styles and composited ancestor backgrounds establish intro, tax/tip helper and joining copy at 3.971:1; saved status at 3.877:1; USD at 3.553:1; compact New bill at 3.603:1; cleared-title placeholder at approximately 2.727:1. Evidence: `iteration-1/contrast-before.json`, `iteration-1/computed-colors.json`, `iteration-1/dirty-amount.png`, `iteration-1/title-expanded-cleared.png`, and the initial combined comparisons. Fix applied: scoped opaque #647268 to the new entry supporting text, compact New bill, USD and title placeholder. Final computed ratios: supporting text/status/New bill 4.719:1, USD 4.803:1, placeholder 4.868:1. The large dollar symbol remains at its passing 3.467:1 large-text ratio. Evidence: `contrast-after.json`, `computed-colors.json` and the final combined comparisons. Improving legibility is an intentional minimal deviation from the reference's muted supporting text. No actionable P0/P1/P2 finding remains.

**Comparison target and normalization**

- Source visual truth: `/workspace/generated_images/exec-2896f8ee-27df-422b-b2a4-e320b6503d95.png`, selected Option 1, 852 × 1846 raster pixels.
- Approved requirements: `/tmp/family-meal-splitter-web/docs/bill-first-entry-requirements.md`.
- Implementation: frozen production export at `http://127.0.0.1:8084/family-meal-splitter-web/`, served from `/tmp/family-meal-splitter-web/out`.
- State: genuinely new editable bill, zero households, default Dinner bill title collapsed, 0.00 USD, no focus, no warnings.
- Browser: real Chromium; 390 × 844 CSS pixels, deviceScaleFactor 1; screenshot 390 × 844 pixels, no browser/device chrome.
- Source resized uniformly to 390 × 845 and only the final blank bottom pixel cropped to 390 × 844. No stretching, warping or content cropping.
- Combined input: `comparison-full.png`, normalized reference left and rendered implementation right. Focused combined evidence: `comparison-header.png`, `comparison-hero.png`, `comparison-amount.png`, `comparison-actions.png`. All five images were opened and inspected before making fidelity judgments.

**Five required fidelity surfaces**

1. Fonts and typography: Georgia/Times serif intro at 48px, weight 600, line height 47.52px and restrained tracking; Arial/Helvetica sans controls. Display line break, headline hierarchy, currency size, labels, helper wrapping and CTA hierarchy closely match. Actual serif headings and action text are a little heavier than the generated reference; a minor P3 rather than a density/wrapping change. No truncated labels in the reviewed 320/390/393 entry views.
2. Spacing and layout rhythm: compact header, 20px mobile insets, two-line introduction, prominent 76px amount field, optional name, divider, household prompt, primary action and example align with the reference composition. Primary CTA spans y658.53–712.53 and example y729.53–777.53 at 390 × 844. Minor single-digit-pixel differences in helper/title/action rhythm are P3. Desktop uses a comfortable reading column. No empty side dashboards or whole-app card. Warning and expanded-name states legitimately extend the document and scroll.
3. Colors and tokens: cream #f8f7f2, ink #243e39, teal #19796a and CTA #127b6d preserve the palette. Ink measured 10.738:1; teal actions 4.914:1; white CTA text 5.147:1. The supporting text P2 is resolved by the entry-scoped #647268 correction; computed supporting text is now 4.719:1, USD 4.803:1 and title placeholder 4.868:1. Full editor/shared tokens were not changed. This is a targeted normal-text contrast check, not a claim of full accessibility compliance.
4. Image quality and asset fidelity: local compressed WebP shows the intended salad plate with arugula, tomato and shaved cheese on a striped napkin. The crop, lighting and generated plate/napkin geometry vary slightly from the source, an acceptable P3 generated-photo variation. Image is sharp at 1×, retains clean transparency/background integration with no visible halo, and avoids text, targets, validation and focus indicators. Existing brand utensil mark/wordmark and Lucide controls were retained as required. No image was replaced with CSS art or custom illustration approximations.
5. Copy and content: visible entry copy matches the approved wording and order. Dinner total is the textbox's accessible name. USD and Include tax and tip provide context. The optional name is a real expansion control; Try an example is a semantic button. Fresh entry has no status instructions/New bill/zero statistics/message panels. Dirty entry offers compact New bill and quiet saving feedback; recovery warnings remain prominent and entry storage warnings do not direct users to an unavailable Share control.

**Interaction evidence**

Fresh independent click/keyboard/touch harness: `verify.cjs`; machine results: `machine-report.json`. Sixteen functional groups passed on both the initial and final frozen exports, including amount identity/caret/position; title persistence and restored-title focus latch; New bill cancel/reset plus history/quota failures; corrupt recovery; zero/incomplete first household and last removal; child age, keyboard and touch slider/reset; exact-cent examples; native clipboard; both privacy options and immutable source/revised read-only snapshots; per-tab/opener isolation; unsaved shared Continue/logo; explicit legacy recovery; hostile literal/control rejection; manual clipboard/dialog keyboard fallback; production CSP inline hashes; and late-digest Continue/back/copy protections. No console errors, page errors or failed requests were recorded in either completed run. Deliberate storage/history/clipboard rejections are expected probes, not product failures.

Additional readable viewport evidence includes `entry-320.png`, `entry-393.png`, `entry-1280.png`, expanded title, validation, dirty/cancel/confirmed New bill, storage warning, first/final household, populated example, sharing and read-only screenshots. These were individually opened and inspected. Native clipboard evidence records actual browser clipboard readback equality with the message and share URL; the API was not mocked for that check. The manually rejected clipboard API is a separate fallback probe.

**Comparison history**

1. Initial frozen export: combined full and four focused comparisons showed close composition with only minor font/photo/spacing variations. Computed text contrast subsequently revealed the P2 above. Initial comparison, computed colors, machine results and manifest are retained under `iteration-1/`; the result was blocked.
2. Corrected final frozen export: implementer applied only entry-scoped text/placeholder color changes plus a regression check, rebuilt and refroze. Fresh Chromium captures at identical dimensions/state produced the root-level `comparison-full.png` plus all four focused comparisons, all opened and inspected after the fix. Computed contrast passes the targeted normal-text checks. All sixteen independent functional groups passed again, including the three prior reviewer regressions, native clipboard and warning exceptions. All 42 frozen source and 34 export files match their manifest hashes both before and after verification (`integrity-summary.json`); the two hash sets are identical. No remaining P0/P1/P2 issue.

Functional harness selector/timing corrections were harness corrections, not visual design iterations or application changes.

**Open questions**

None. The user-approved requirements require legible text; a small, entry-scoped muted-color correction is appropriate without changing the layout or broad editor/shared design tokens.

**Implementation checklist**

- [x] Apply the minimal scoped normal-text and placeholder contrast correction.
- [x] Rebuild/refreeze and hash-check the final source/export.
- [x] Recapture the same empty state; rebuild and inspect full and focused combined comparisons.
- [x] Remeasure computed contrast and rerun independent functional/browser evidence on the new frozen export.
- [x] Inspect all final screenshot artifacts, record paths/dimensions/SHA-256 in `screenshots-manifest.json`, and complete final integrity check.

**Follow-up polish**

- P3: optional future optical weight tuning of serif headings and action text, without changing wrapping or hierarchy.
- P3: minor generated-photo crop and napkin arrangement variation; no replacement is needed.
- P3: small title/helper/action vertical offsets relative to the raster target; no above-fold impact.

This is local production-export verification. Hosted release verification belongs to the release owner after deployment. No exhaustive accessibility or security certification is claimed.

final result: passed
