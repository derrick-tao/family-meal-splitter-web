# Family Meal Splitter simplified bill and sharing requirements

Source: https://chatgpt.com/space/page_001e39c19fe48191abf365bc2b494b05

**Approved by the user on 2026-11-11 after independent clarity review.**

The app should let someone create a bill, refresh without losing progress, and save or exchange a fixed version by keeping a shared URL. Every tab has one independent editable bill. Shared links display their encoded values read-only. Remove the different saved-dinner and local-copy experiences and remove whole-bill Reset actions.

# Agreed product decisions

- One editable bill per tab. New bill replaces that tab's current work; a saved URL is how a user keeps a version for later.
- Refresh preserves the editable bill while that tab's browser session storage remains available. Recovery after closing a tab or browser is not guaranteed.
- Tabs edit independently. A new independent tab at the plain app URL starts blank. A duplicated or opener-created tab may initially inherit the original tab's values; subsequent edits and New bill actions remain independent.
- Opening an encoded URL displays its snapshot without replacing the tab's editable bill. Make a copy explicitly imports that snapshot into the editable bill.
- Sharing captures the currently displayed values. It does not update an earlier link or navigate away from the current bill.
- Remove Reset changes and Reset saved dinner. Preserve each child's separate Reset to age default action.

# Two experiences

| Experience  | What opens                                                                                   | Available bill actions                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Your bill   | The plain trusted app URL restores this tab's editable bill, or starts blank if none exists. | Edit, Share, New bill, Load Example Dinner, Copy Message.                                                                       |
| Shared bill | A valid existing version 1 encoded URL always displays precisely its snapshot read-only.     | Make a copy, New bill, Share, Copy Message. Continue my bill is a secondary link only when this tab has existing editable work. |

No bill list, browser-wide shared draft, baseline-restoration action, local-copy banner, View original snapshot action, or user-facing draft identifier is needed. Use the same editor, saving rules, Share label, and New bill behavior for every editable bill, whether it began blank, from the example, or from a shared link.

# Starting editing and refreshing

A blank bill uses the existing default title Dinner bill, $0.00, no households, and Fun tone. All existing household, child, amount, validation, and live calculation behavior remains.

Save edits automatically to a new fixed, app-namespaced, versioned sessionStorage key for this tab, distinct from every legacy key. Use a strict new record schema; old version 1 keys are read-only recovery sources. Preserve title, amount text including incomplete edits, tone, stable household and child IDs, adult counts, names, incomplete ages, selected percentages, and override flags. Refresh restores the latest successfully stored values without a submit or save button.

The editable address is the trusted app base path, without an encoded share fragment or a new draft query selector. The existing View split anchor may remain. Copying the plain working address does not transfer the bill; Share is how to create a portable link.

Show a short, accurate status: Saved in this tab. Use Share to keep a link for later. Never claim cloud saving or guaranteed recovery after closing. If saving fails or storage is unavailable, allow in-memory editing with a visible warning that refresh or leaving can lose edits. Show saved status only after a successful write; preserve the previous valid stored bytes on failed writes.

# Shared bills and making a copy

Opening, refreshing, returning through history to, or reopening a valid shared URL always shows the original encoded values. All configuration controls are read-only or absent, including title, amount, tone, names, ages, adults, child sliders, add/remove actions, and Load Example Dinner. The displayed payments and copied message derive from exactly those snapshot values.

Viewing a shared bill never overwrites or merges into editable work. Make a copy explicitly deep-copies the displayed snapshot into this tab's editable bill and navigates in the same tab to the plain app URL. The source URL remains unchanged and valid. The copied bill uses exactly the provided names or initials, ages, selected percentages, and overrides. It has the same behavior and persistence as a bill started blank.

If there is meaningful editable work in this tab, confirm before Make a copy replaces it, even when that work is not currently displayed. Suggested confirmation: Replace your current bill? Keep its share link first if you want to return to it. Buttons: Keep my bill and Replace bill. Cancellation leaves displayed data, address, and all stored records unchanged. An unreadable existing record also requires an explicit replacement consequence before it may be overwritten.

Meaningful work means any difference from the complete clean blank bill, including a changed title or tone, incomplete amount text, or any household. No confirmation is needed to replace a genuinely blank valid bill or an absent record.

Continue my bill returns to this tab's existing editable bill without importing snapshot values. The app logo opens the current tab's editable bill with the same behavior. Do not make source-link navigation or recovery controls permanent options in the editor.

# New bill replaces the current work

Use the single label New bill everywhere. It replaces this tab's editable work with the clean blank bill and navigates to the plain app URL. From a shared view, it starts blank rather than copying the snapshot. It never changes a shared URL's contents or another tab's bill.

If this tab already contains meaningful work, confirm before replacing it. Suggested confirmation: Start a new bill? This replaces your current bill in this tab. Keep its share link first if you want to return to it. Buttons: Keep my bill and Start new bill. Cancellation changes nothing. Unreadable stored work requires the same explicit consequence. No confirmation is needed for an absent or clean blank bill.

New bill is replacement, not an undoable reset. Browser Back may return to a read-only shared URL but does not resurrect an older editable bill that was replaced. Plain app history entries show the current editable bill for the tab. Confirmations must not imply that an earlier URL automatically contains subsequent edits.

Load Example Dinner remains an editor-only action and uses the same replacement protection for existing meaningful work. It produces an ordinary editable bill and introduces no special baseline or reset behavior.

# Sharing and saving through URLs

Use the label Share in both experiences. Preserve the explicit privacy dialog on every activation: Use children's initials selected by default, Keep names as entered as the alternative, and ages retained in either case. Disclose that the link also includes the dinner title and household names, that initials do not make the bill anonymous, and that anyone with the link can read it.

The app stores no bill information on an application server. It saves the editable draft in this tab's browser storage, and the shared URL itself contains the snapshot. Retain the existing explanation of browser and hosting privacy limitations. Do not imply that encoded data is encrypted or that links have authenticated authors.

Create and copy the link from the exact current validated displayed bill. Privacy transformations affect only the outgoing snapshot, never the original editor values. Keep the version 1 URL format, trusted app origin/path, regenerated export IDs, current bounds, deterministic serialization, and manual-copy fallback. Omit draft selectors and unrelated query parameters.

Copying the link keeps the current address and editable bill unchanged. Changed serialized values produce a different URL; identical values may reproduce the same URL. An older link always opens its earlier values. Tell users briefly in the sharing dialog: This link saves the values shown now. Share again after editing to keep the updated version.

Someone opening the new link sees its read-only snapshot and can Make a copy to create and share a further revision. To recover a bill after closing its tab, open a saved shared URL and choose Make a copy. Copy Message remains separate, live, plain text, accurate for multiple adults, and excludes children's ages as before.

# Tab behavior and navigation

Use sessionStorage rather than live localStorage for the active editable bill. Never synchronize edits between tabs using storage events, BroadcastChannel, or shared mutable browser-wide records.

Test truly independent new tabs and duplicated/opener-created tabs separately. Independently opened tabs without an opener in the same browser context must remain isolated; testing only separate browser contexts is insufficient. A new independent tab at the plain URL starts blank. A browser may clone initial sessionStorage into an opener-created or duplicated tab; accept that initial copy, then require independent edits, refreshes, and New bill actions. Do not promise that closing always deletes drafts or that reopening always restores them.

Opening a valid shared URL in a tab with work preserves that work, including when the user uses Back, Forward, Continue my bill, or refresh. Source and revised snapshot URLs remain immutable. In-app navigation that would lose unsaved in-memory edits after a storage failure must warn; browser-close protection is best effort. No save-to-server, login, bill library, or cross-device draft syncing is introduced.

# Compatibility and recovery

Existing version 1 shared URLs remain fully supported. Earlier localStorage bills, shared-edit overrides, and version 1 per-tab session records must not be silently deleted, rewritten, or used to replace the displayed shared snapshot.

Do not automatically import earlier browser-wide localStorage data into the new per-tab editor. Otherwise an independently opened tab would unexpectedly inherit a browser-wide bill. Offer explicit recovery of validated earlier data under a secondary recovery control only when it exists, not in the normal primary actions. Each recovery identifies its source and replaces the tab's editable bill only after the normal replacement confirmation. Original legacy bytes remain intact after successful import.

For old version 1 per-tab session records, allow explicit recovery of their current bill after full existing validation. There is no need to retain their reset baseline in the new record. A valid old ?draft= address offers recovery only when its identifier matches that tab's validated old record. A missing, mismatched, malformed, duplicate, or draft-plus-share address must not reveal a different bill or overwrite any stored record. Recovery navigates to the plain app path without the old selector. Do not introduce new pointer URLs.

An old browser-wide shared-edit override is offered only when its validated digest matches the currently viewed snapshot. The original snapshot remains read-only and unchanged. Corrupt or unrelated records never block a valid shared bill; preserve their bytes and use an accurate, unobtrusive recovery warning. The active new-format record takes precedence for the editable bill and is not silently replaced by legacy data.

# Security and failure behavior

Preserve all existing strict input validation, bounded decoding and storage, Unicode/control-character handling, safe text rendering, exact-cent allocation, age defaults, independent overrides, CSP, and same-origin asset requirements. All URL and stored input remains untrusted.

The new fixed storage record contains only the validated current bill plus necessary schema metadata. It needs no immutable baseline, source URL, or user-selected storage key. Apply the current 1 MiB whole-record limit and existing snapshot count, text, byte, and URL limits. Preserve temporarily incomplete editor inputs without allowing unsafe names, invalid structures, NaN, or Infinity.

No user-supplied field, query parameter, or stored URL may become HTML, script, an arbitrary redirect, storage key, file path, or network destination. Ignore unrelated query parameters as commands, reject ambiguous supported selectors, and never propagate queries into generated share URLs. No names, ages, bill payloads, or session contents go into telemetry or diagnostic logs. Do not add dependencies or a backend to solve persistence.

Handle malformed or oversized links, corrupt records, blocked storage, quota failure, and history navigation errors without silently clearing prior data. A failed write must not discard the prior saved record. If app-controlled navigation fails, leave the address, displayed values, in-memory editable bill, and stored records unchanged. Within the loaded app, displaying a snapshot must preserve the separate in-memory editable bill; Continue my bill restores it, including newer edits that could not be saved. Refresh or a full-page navigation cannot guarantee preservation of unsaved memory, so warn accurately when storage fails. Any in-memory fallback must identify what is and is not saved. Deliberate New bill, Make a copy, or recovery after explicit confirmation may replace only this tab's active record; cancellation preserves address, displayed values, and storage bytes.

# Acceptance and verification

1. Starting blank, entering a bill, adding households/children, editing individual portions, and refreshing restores the full editable state. Both complete and temporarily incomplete input survive where structurally valid.
2. New bill confirms before replacing meaningful work, creates the clean defaults, removes shared/old pointer addressing, and affects only this tab. Cancellation leaves exact values, address, and raw storage unchanged.
3. There is no whole-bill Reset, Local copy banner, Reset saved dinner, Share changes label, View original snapshot editor action, or competing saved-dinner mode. Child Reset to age default remains.
4. Sharing the example produces the exact original amounts $62.67, $40.44, $90.98, and $60.65, summing to $254.74. Privacy starts at initials each time; both options retain ages and affect only exported data.
5. Opening that URL shows the read-only original and preserves existing editable work. All mutators remain unavailable until Make a copy. Continue my bill restores the existing bill without importing the snapshot.
6. Make a copy confirms before replacing existing meaningful work, navigates to the plain editor, and remains editable after refresh. It does not modify the source link or another tab.
7. Changing Child A2 from 30% to 50% produces $68.58, $39.19, $88.18, and $58.79. Share produces a revised portable URL; a fresh recipient sees those values, and a fresh visit to the original URL still shows the original values. Both totals remain $254.74.
8. Sharing keeps the editor address and values unchanged. Copied message equals its preview exactly and uses the same payments. Old URLs do not absorb later edits; a saved revised URL can recover its values through Make a copy after the original tab closes.
9. Two independently opened tabs without an opener in the same browser context can hold different bills; editing, refresh, sharing, and New bill do not alter the other. Repeat in separate contexts. Test a real opener-created or duplicated tab's inherited initial data and subsequent independence separately.
10. Refreshing a snapshot always shows its encoded original. Back/Forward, Continue my bill, app logo, View split, and replacing an editable bill follow the stated navigation rules without baseline resurrection.
11. Old shared URLs and explicit legacy recovery work; missing/mismatched old pointers, invalid payloads, hostile literal names, oversized records, duplicate selectors, ambiguous addresses, quota failures, unavailable storage, and history failures preserve prior bytes and do not execute or dispatch attacker content.
12. Check the main flow at 320px and 393px mobile and desktop: readable actions, no horizontal scrolling, accessible labels and keyboard sliders, dialog focus containment/return, cancellation, clear saved/error status, and manual link/message copy fallbacks.

Run formatting, lint, TypeScript, unit tests, automated browser tests, and the production static GitHub Pages build with CSP processing. Update README and supersede the previous reset/session requirements without losing the security baseline. Preserve all previously required financial and message tests, adapting session tests to the new product behavior.

# Review and release workflow

This spec supersedes the previous three-mode snapshot reset and local session requirements only where explicitly changed. Existing calculation, title, privacy, input-security, accessibility, and fictional sample-data requirements continue to apply. Samples, fixtures, documentation, screenshots, and demo text use only the fictional Family A–D and Child A1–D2 names.

A fresh agent reviewed the specification for clarity and consistency. All findings were resolved before the user approved implementation on 2026-11-11.

After explicit spec approval: a subagent implements; a separate agent reviews changes and findings are fixed; a fresh agent clicks through the production app and captures screenshots; the coordinator reviews that evidence before committing and pushing; GitHub Pages deploys; verify the public release and share the repository and application links.
