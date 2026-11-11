# Family Meal Splitter bill first entry requirements

Source: https://chatgpt.com/space/page_b36c8b8188e88191a9ccfb4e6f192c77

**Approved by the user on 2026-11-11 after independent clarity review.**

Selected visual: Option 1, the first displayed bill-first design. This changes the entry experience of an editable bill with no households. Existing shared-link, per-tab persistence, calculation, privacy, and security requirements remain in force.

Start with the dinner total, then offer one clear Add a household action. A blank bill should not greet people with saving instructions, New bill, or empty dashboards. The chosen visual target is the first generated image displayed in the redesign discussion, included with this specification. Its intended mobile viewport is 390 by 844 CSS pixels; the generated raster uses a larger resolution at the same aspect ratio.

# Selected design

Retain the app wordmark and utensil logo, warm cream background, dark green ink, teal actions, restrained coral accents, serif introductory headline, and readable sans-serif controls.

The initial screen follows this order:

1. Compact brand header.
2. Let’s split dinner. with the second line or key word in teal, plus Start with the total. We’ll take it from there.
3. Dinner total: prominent editable USD amount, initially $0.00. Helper: Include tax and tip.
4. Add a dinner name: a quiet optional action with a pencil icon, revealing the existing configurable title input inline.
5. Who’s joining? followed by Add the households at your table.
6. Full-width primary Add a household button.
7. Secondary Try an example action: a semantic button styled as a text link, using the existing protected example-replacement action.

Recreate the selected cropped dinner-plate photograph in the upper-right introduction area as a local decorative image asset. Generate the image asset from the selected visual, with no UI text, names, logos, or watermarks. Use the existing supplied logo and closest existing Lucide icons for ordinary controls. No account, onboarding tour, wizard, saved-bill library, or new storage mode is introduced.

# When to show the entry surface

Show the new entry surface in editable mode whenever the current bill has zero households, whether it is genuinely new, an intentionally cleared bill, or a restored bill containing only a total/title/tone. Do not rely on a first-visit flag, cookie, browser-wide record, or storage clearing. A saved clean blank bill should look the same as a genuinely fresh blank bill.

Keep this layout while the user types the amount or optional title. Do not switch to another layout, move or remount the focused input, hide typed text, or scroll to the top after the first keystroke, saving, or blur. Changing the amount must not reveal empty results or a message preview.

Show amount validation beside the input whenever its value is invalid; hiding results must not hide the error. With no households, the household prompt supplies the next step rather than rendering an empty allocation error. Active storage and navigation warnings remain visible outside collapsed recovery controls. Zero-household warnings must not tell users to use an unavailable Share control; state the saving failure, risk on refresh/leaving, and preservation of previous bytes accurately.

A shared snapshot always keeps its existing read-only experience, even if it contains unusual zero values. Invalid links, unavailable legacy pointers, corruption warnings, unsaved-memory warnings, and explicit legacy recovery retain their existing accurate behavior; the entry design must not conceal errors or silently replace stored data. Keep secondary legacy recovery below the main entry content, so it does not displace the first useful task on a normal load.

# Editing and progression

Dinner total is a real editable input, using the existing cents parser and persistence behavior. Allow zero and temporarily incomplete amount text as before. Do not require a positive amount or a complete amount before adding a household. Do not silently replace the entered amount with a sample total.

Add a dinner name expands an inline labeled title input and focuses it without navigating, clearing values, or saving a new title merely because the field opened. Preserve the existing default Dinner bill until the user changes it. Keep the field expanded while the user edits, including when clearing its value. On refresh or returning to the entry surface, show the title input expanded when the stored title differs from the default, including an explicitly cleared title. Opening or focusing the optional field alone is not meaningful work.

Add a household immediately creates one normal household using the existing behavior: stable generated ID, blank editable name with its existing household-name fallback, one adult, no children. Retain amount, title, tone, and current validation state. Transition to the existing full editor and focus the new household name, scrolling it into view if needed. This is an explicit action, not a submit gate for the amount. Subsequent households, children, ages, sliders, calculations, message generation, and sharing continue through the established editor.

Use the existing full editor for bills with one or more households, including restored bills, imported copies, examples, and recovered legacy bills. Its behavior is unchanged. If the user removes the final household, show the new entry surface with the surviving amount/title/tone intact, not a newly blank bill. Move focus to Add a household, scrolling it into view if needed; do not leave focus on a removed element or automatically open the keyboard. New bill remains the explicit action that clears all values.

Try an example loads the existing fictional Family A–D dinner. Preserve the normal confirmation before replacing meaningful work or an unreadable active record. On a clean blank bill, no replacement confirmation is needed. The full editor may keep its existing Load Example Dinner label.

# Saving and New bill visibility

All zero-household entry states omit zero-household/zero-person statistics, payment summaries, message previews, and unavailable Share/Copy Message controls. For a clean blank editable bill, also hide the whole normal saving/status row and New bill. Do not show Ready to edit as another status substitute. The first useful content is the amount input and the household action. Meaningful work only enables the specified compact New bill action and truthful saving feedback; it does not reveal empty result panels.

An unreadable active record is never treated as a clean blank bill for replacement controls. Keep its warning and a New bill recovery action visible, even before edits. Require the existing explicit replacement confirmation; cancellation and ordinary edits preserve the unreadable stored bytes. This recovery exception does not make New bill visible for a genuinely absent or valid clean record.

Continue autosaving actual edits under the same per-tab key and schema. Once meaningful work exists, New bill remains available as a compact secondary action beside the Dinner total heading. Reserve the heading-row height so showing or hiding the action does not move the amount input. Meaningful work uses the existing canonical comparison with the clean bill; UI expansion or focus alone must not trigger it.

If saving feedback is shown on the entry surface after an actual edit, place it quietly below the primary entry actions. Use the same truthful saved/unsaved state; do not place Saved in this tab or Use Share to keep a link for later above the form. Do not give a Share instruction while Share is unavailable without a household. A storage failure must always show an accessible warning and must not claim the changes were saved.

New bill uses the already approved confirmation and replacement behavior. It returns to the clean entry surface with $0.00, default title, no households, Fun tone, and no no-op New bill control. Cancel preserves exact current values, address, focused form state where practical, and storage bytes. Other tabs and previous encoded URLs remain unaffected. Whole-bill Reset stays removed; per-child Reset to age default remains.

# Visual and responsive requirements

Match the chosen image closely at 390 by 844: compact header, welcoming introduction, amount as the main visual anchor, optional title action, light divider, household prompt and primary action, and secondary example link. There is no whole-app card or large technical status banner.

The decorative plate image must not cover text, input targets, focus rings, or validation messages. Keep it decorative with empty alt text and noninteractive positioning. Load a compressed local asset using the trusted app base path; no external image requests or new CSP allowances. If space is tight, reduce or hide the decoration before compromising controls or readable text.

At 390 by 844, show the primary household button and example action in the initial viewport under default font settings. Also verify 320 by 844 and 393 by 900, with no horizontal scrolling. At narrower or shorter viewports, reduce spacing and decoration; never shrink body text below readable product sizes to force a fit. Scrolling is expected when the keyboard is open or text is enlarged. Desktop keeps the same task order in a comfortable reading column; do not render empty side dashboards merely to fill width. Existing populated desktop and shared layouts remain responsive.

Use visible input labels, USD and tax/tip context, logical tab order, visible focus states, at least 44-pixel primary targets, semantic buttons/links, and programmatic expansion state for the optional title action. Do not autofocus on initial page load and unexpectedly open the mobile keyboard. Explicitly choosing the title action or adding a household may focus the appropriate field. Updates must preserve screen-reader access to validation and saving errors.

# Compatibility and security

Use the current bill, IDs, per-tab sessionStorage key/version, exact-cent engine, snapshot codec, trusted URL construction, and bounded validation. No new user-data storage fields or URL selectors are needed for the presentation change. Names and title remain plain text, and the optional title reveal must not introduce HTML injection or arbitrary attributes.

Preserve existing refresh recovery, independent tabs, opener-clone independence, immutable shared URLs, Make a copy, replacement confirmations, explicit non-destructive legacy recovery, storage/history failure preservation, delayed-digest navigation guards, both privacy choices with ages retained, and native/manual clipboard behavior.

New example text, fixtures, assets, and screenshots use only fictional Family A–D and Child A1–D2 participant names. No real names appear in the decorative image or new sample text. Retain the existing explanation of URL snapshots and browser storage when users actually share.

# Acceptance and verification

1. A truly new independent tab and a restored clean blank record show the selected bill-first entry with no saving instructions, New bill, zero statistics, empty dashboard/message, or disabled share/copy actions before the first useful task.
2. Typing and autosaving preserve the active input, caret, and layout. Keep existing valid-on-blur amount formatting; preserve incomplete invalid text. Refresh restores persisted values and title expansion without automatically focusing an input. A customized or explicitly cleared title is accessible after refresh. Initial load does not open the mobile keyboard.
3. After meaningful amount/title/tone work, the compact New bill action appears without moving the amount input. Replacement cancellation preserves exact state/bytes; acceptance returns to the same clean entry appearance and hides the now-useless action.
4. Adding the first household works with zero or incomplete amount, preserves the bill, creates the normal default household, reveals the full editor, and focuses its name. Removing the final household restores the entry surface without clearing the bill.
5. The optional title uses its existing limits, safe text handling, default/fallback behavior, live display, snapshot export, and refresh persistence. UI-only title expansion does not make a blank bill nonblank.
6. Try an example works immediately on blank and confirms before replacing meaningful or unreadable work. The exact original/revised fictional payments and message/clipboard consistency still pass.
7. Shared snapshots, copies, nonempty restored bills, independent same-browser tabs, legacy recovery, quota/corrupt storage, invalid URLs, history failures, and late digest completion retain the approved behavior. Verify inline amount errors and active warnings remain visible on the entry surface, contain no unusable Share instructions, and unreadable active records keep a confirmed New bill recovery action with byte-preserving cancellation.
8. Compare actual screenshots with the selected reference at the same 390 by 844 empty state. Verify 320/393 mobile and desktop, keyboard focus/title expansion, text reflow, image availability at the Pages subpath, asset/CSP safety, and no normal browser errors.

Run formatting, lint, type checks, relevant unit and browser tests, and the production static build with CSP. Update tests whose initial-label and empty-dashboard assumptions change without weakening financial, privacy, persistence, or security assertions. Perform a visual QA comparison against the selected image and fix material differences before the release evidence review.

# Review and release workflow

A separate agent reviewed this specification for clarity before the user approved implementation on 2026-11-11. The draft approval gates are complete.

After approval, use the established workflow: subagent implementation; separate code review and fixes; fresh real-browser verification with screenshots and design comparison; coordinator review of the evidence before commit/push; GitHub Pages deployment; hosted verification and repository/live links.

This spec changes the entry presentation and relevant initial action labels of the approved simplified bill requirements at https://chatgpt.com/space/page_001e39c19fe48191abf365bc2b494b05. It does not change their underlying financial, persistence, sharing, privacy, security, or replacement rules.
