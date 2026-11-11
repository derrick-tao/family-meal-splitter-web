# Snapshot reset and local session requirements

> Superseded where behavior differs by the user-approved [simplified bill requirements](simplified-bill-requirements.md). The financial, privacy, and input-security baseline continues to apply.

Source: https://chatgpt.com/space/page_38e8e6d98ddc8191b34eb7e9db3434fa

This draft revises how [Family Meal Splitter](https://derrick-tao.github.io/family-meal-splitter-web/) separates original shared snapshots from editable copies. It replaces the previous rule that reopening a shared URL could restore local edits associated with that URL. All existing title, privacy, input-security, financial calculation, accessibility, and deployment requirements continue to apply unless explicitly changed here.

**Approved for implementation by the user on 2026-11-11.** A fresh subagent reviewed the proposed behavior and found no blocking questions after the clarifications below.

**Main changes for approval:** shared links open a read-only original; editing starts in a separate per-tab local draft; Reset changes restores that draft’s starting values; sharing revised values generates a portable snapshot link without altering the original.

# Three clearly separated modes

| Mode                  | Browser address                                     | Behavior                                                     |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Shared snapshot       | Existing `#share=v1.…` link                         | Always displays the encoded original, read-only.             |
| Local working copy    | `?draft=<opaque UUID>`, without an encoded fragment | Editable per-tab draft that can be shared as a new snapshot. |
| Ordinary saved dinner | Base app URL                                        | Existing editable dinner stored in localStorage.             |

The working-copy identifier is a local pointer, not a public dinner record, authentication credential, or server lookup. Copying a working-copy address does not transfer its dinner data to another person.

# Shared snapshots always show the original

Opening, refreshing, revisiting, or returning through browser history to a valid shared URL must show exactly the values encoded in that link. Neither a current draft nor an older saved override may replace them.

The shared view shows the dinner title, bill amount, household details, children’s ages and portions, payment results, and message. All configuration controls are read-only or absent: title, amount, names, ages, adult counts, sliders, add/remove actions, tone changes, Reset, and Load Example Dinner cannot mutate data underneath a shared address.

Available actions are **Edit a copy**, **Start new dinner**, **Open my saved dinner**, **Copy Message**, and **Share dinner**. Sharing still opens the existing explicit privacy dialog and transforms only the outgoing snapshot; it does not change the displayed original.

The original encoded URL is never rewritten by editing, resetting a copy, or sharing changes. This does not prevent someone from manually creating a different valid snapshot; links remain unauthenticated data.

# Edit a copy creates a separate local session

Selecting **Edit a copy** opens an editable copy in the same tab and navigates to the trusted app path with a newly generated `draft` UUID. The editable address has no shared fragment or encoded dinner data. Browser Back can return to the unchanged original shared snapshot.

The session retains an immutable starting baseline and a separate current bill. A snapshot-derived copy starts from the received snapshot, including its title, tone, children’s names or initials, ages, percentages, and override flags. Editing must not mutate the baseline or the source snapshot.

Keep one active working copy per tab in a fixed, app-namespaced sessionStorage record. Its current values survive refresh while that page session remains available. The ordinary saved dinner stays in its separate localStorage slot and is never overwritten by these edits.

Show a visible **Local copy** status and explain: **This copy is local to this tab. Use Share changes to create a link that others can open or that you can keep for later.**

This is not a durable saved-dinner feature. Browsers may restore page sessions after closing or restarting, and duplicated or opener-created tabs may initially receive copied sessionStorage. Those tab copies subsequently edit independently. Do not promise either guaranteed deletion on close or guaranteed recovery after closing.

# Reset and starting a new dinner

**Reset changes** applies to a local working copy. It restores the entire starting baseline, including title, amount, households, children, ages, percentages, override flags, and tone. Confirm before discarding changes. The working-copy UUID and address remain the same; the original encoded link remains unchanged. If the baseline was blank, Reset changes restores that blank baseline.

**Start new dinner** creates a new blank local session with a new UUID, the default Dinner bill title, and no shared fragment. It does not clear the ordinary saved dinner. Before replacing another active session, confirm if that session contains edits that would be discarded—even if the user is currently viewing an original snapshot or their ordinary saved dinner.

In the ordinary saved-dinner mode, label the destructive reset **Reset saved dinner**. Its confirmation explicitly states that it clears the ordinary dinner saved in this browser. It must not clear a separate active working-copy session.

Load Example Dinner remains available in editable modes. In a working copy it changes the current bill after the normal confirmation, but it does not redefine the session’s starting baseline.

Cancelled actions leave bill values, browser address, source reference, and stored records unchanged.

# Sharing changes back

A working copy provides **Share changes**. Every activation opens the existing privacy dialog with children’s initials selected by default and Keep names as entered as the alternative. Children’s ages remain included in both modes. Existing household/title disclosures and privacy limits still apply.

Create the outgoing portable link from the currently displayed, validated values. It uses the existing version 1 snapshot format at the normal app path, without the local `draft` selector or any unrelated query parameters. Copying the link does not navigate away from the working copy or modify its baseline, source link, or ordinary saved dinner.

A person receiving the new link sees its revised snapshot read-only and can choose Edit a copy to respond with another version.

When serialized snapshot content differs, the encoded link differs. Identical serialized content may reproduce the same link; do not add randomness merely to make unchanged snapshots look new. Choosing a different privacy option changes the link only when it changes the outgoing data. The original link continues to show its original values.

# Navigation and unavailable local copies

**View original snapshot** in a snapshot-derived working copy navigates to its validated original shared fragment at the trusted app origin and base path. It does not overwrite the local session. Browser Forward or revisiting the matching working-copy address in that tab can restore the draft while its session record remains available.

**Open my saved dinner** navigates to ordinary saved-dinner mode without copying working values into its localStorage slot. The active session record remains available unless it is deliberately replaced.

A missing, mismatched, corrupt, or unavailable working-copy record must not fall through to another draft. Show **This local copy is not available in this tab**, with **Open my saved dinner** and **Start new dinner** recovery actions. Offer a direct original-snapshot action only when a validated source is actually available; an opaque draft ID alone cannot recover it.

Guard app-controlled actions that discard in-memory edits or replace an edited active session. Warn about losing unsaved changes when storage fails. Browser-close protection is best effort, particularly on mobile, and must not be advertised as guaranteed.

Status labels must distinguish read-only snapshot, local copy, ordinary saved dinner, and unsaved/storage-error states accurately.

# Compatibility and recovery of earlier edits

Existing version 1 shared links remain valid. They now open their original snapshot and ignore the old last-edited-shared override for display.

Do not automatically delete or overwrite the old shared-draft localStorage record. If its validated digest matches the current original snapshot, offer **Recover previous edits as a local copy**. Recovery creates a separate working session whose current values come from those prior edits and whose reset baseline is the original snapshot. Apply the normal active-session replacement confirmation.

A corrupt or unrelated old record must not prevent a valid shared snapshot from displaying. Preserve its bytes, provide an accurate recovery warning when appropriate, and do not expose an unrelated draft’s contents.

Ordinary saved dinners, title migration, and their existing persistence behavior remain intact. This feature does not add a saved-dinner library.

# Security requirements for local sessions

Retain the existing strict snapshot codec, name/title text handling, Unicode and control-character checks, privacy transformations, regenerated export IDs, exact-cent calculations, resource limits, CSP, and safe failure behavior.

The sole new supported query selector is one bounded, valid app-generated `draft` UUID. It selects only the matching record in this tab. Reject duplicate draft selectors, malformed identifiers, and an ambiguous address containing both a draft selector and a shared snapshot. Ignore unrelated query parameters as commands or dinner data and never propagate them into generated addresses. Local working-copy addresses contain no encoded fragment.

Never use a draft selector as an arbitrary storage key, file path, resource destination, or redirect target. It must not trigger a network lookup. Store the session under one fixed app key and compare the identifier inside its validated record.

Treat all sessionStorage values as untrusted. Define an explicit versioned record schema and validate its identifier, baseline, current bill, and optional original fragment. Preserve incomplete amount text in editable drafts while retaining structural and resource validation. Count the whole serialized record—including current values and baseline—against the existing 1 MiB per-record limit.

The baseline must be independent of edits. If both a source fragment and baseline are retained, validate that they describe the same original values. Reconstruct source navigation from the validated fragment and trusted deployment origin/path; never navigate to an arbitrary URL supplied by storage.

On invalid links, mismatched identifiers, rejected records, or write failures, do not silently replace stored data with empty values or another dinner. Deliberate recovery or reset may replace the specific local record only with the stated consequences. Storage failures may permit in-memory editing with an accurate warning.

The UUID is not an authentication boundary. Local session data remains accessible to trusted scripts on the same browser origin, as already disclosed for this GitHub Pages hosting model. No names, ages, draft contents, or shared payloads go into query parameters, telemetry, or logs.

# Acceptance and verification

1. A shared URL always displays its original title, bill, households, ages, portions, tone, and payments after refresh, history navigation, and previous local editing. Every mutating control is absent or read-only in this mode.

2. Edit a copy creates a separate same-tab draft address without the shared fragment. The original shared URL remains available and unchanged. The current tab can refresh the matching session and retain its edits.

3. Reset changes restores the complete starting baseline after confirmation without changing either the working-copy address or the original shared link. Cancelling preserves everything. A blank draft resets to blank.

4. Start new dinner creates a different blank local session and removes the encoded fragment. Replacing an edited active session requires confirmation, including when that session is not the currently visible mode. The ordinary saved dinner remains intact.

5. A recipient changes Child A2 from 30% to 50%, then Share changes opens the privacy dialog and creates a portable link with the revised exact payments: $68.58, $39.19, $88.18, and $58.79. The original link continues to produce $62.67, $40.44, $90.98, and $60.65. Both total $254.74.

6. A fresh recipient of the revised link sees its original revised snapshot. Their later independent editing and sharing cannot update either earlier link. Unchanged serialized snapshots remain deterministic.

7. The complete ordinary saved dinner is preserved across Edit a copy, Reset changes, Start new dinner, source navigation, and sharing. Reset saved dinner affects only that ordinary draft after confirmation.

8. A genuinely fresh tab/browser with only a working-copy address receives an unavailable-copy message rather than another bill. Test duplicated-tab behavior separately; copied initial session state may exist but subsequent edits must be independent.

9. Missing, corrupt, mismatched, oversized, duplicate-selector, and ambiguous-mode inputs preserve stored records and cannot cause script execution, external requests, redirects, or cross-draft disclosure. Existing malicious-name and snapshot-codec regressions continue to pass.

10. Legacy overrides never replace the original shared view. Matching previous edits can be recovered explicitly into a new session; corrupt legacy data remains nonblocking and untouched.

11. Browser Back/Forward, logo and View split navigation, clipboard failure, unavailable sessionStorage, write-failure recovery, confirmations, focus handling, and 320px/393px layouts behave accurately. Message preview and copied text remain identical and ages stay out of generated messages.

Run formatting, lint, TypeScript, unit tests, browser tests, and the production static Pages build. After implementation and fixes, a new verification agent must perform real click-through tests in separate contexts and capture readable screenshots of the original shared view, local draft address/state, reset confirmation and restored values, revised sharing, recovery, and narrow-mobile layouts.

# Review and approval workflow

A fresh subagent reviewed this revision for clarity, compatibility, state separation, and security. The review resolved the scope of read-only controls, query-pointer validation, session lifetime, replacement guards, baseline protection, and legacy recovery. No further user questions are needed before presenting this draft.

**The user approved this specification and the implementation workflow on 2026-11-11.** Required release workflow:

1. A subagent implements the revision against the approved requirements.

2. A separate agent reviews the changes; findings are fixed.

3. A fresh agent verifies the production export through real browser interactions and screenshots.

4. The coordinating agent reviews the evidence before committing and pushing.

5. GitHub Pages deploys, the hosted application is verified, and the repository and live links are shared.

No application code, commits, pushes, or deployment changes are part of preparing this draft.
