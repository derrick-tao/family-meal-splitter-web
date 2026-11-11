# Family Meal Splitter sharing and dinner title requirements

Source: https://chatgpt.com/space/page_47587cc80f308191a8f2cd14e2ac6717

**Current behavior:** [Snapshot reset and local session requirements](snapshot-session-requirements.md) supersedes the original recipient-editing, same-link override, shared-draft retention, and reset/navigation rules below. Shared links are read-only originals; editing requires a separate per-tab `?draft=<UUID>` session. The title, privacy, financial, security, and resource requirements here remain the baseline. Historical clauses below are retained as approval history, not current behavior.

This specification adds configurable dinner titles and shareable dinner snapshots to [Family Meal Splitter](https://derrick-tao.github.io/family-meal-splitter-web/). It incorporates the agreed choices: immutable snapshots, immediate recipient editing, a privacy choice for children’s names, and ages retained in both sharing modes.

**Status: approved for implementation.** The user approved these requirements, including the security additions, and requested delegated implementation, separate code review, and fresh browser verification with screenshot evidence before commit and push.

# Scope

The app remains a standalone, mobile-friendly static application hosted on GitHub Pages. Sharing requires no login, database, URL-shortening service, or shared backend. Existing financial calculations, exact-cent rounding, independent child sliders, age suggestions and overrides, Fun and Simple messages, fictional example, and accessibility requirements remain in force.

Shared links capture a fixed configuration. Later changes made by the sender or a recipient do not update an existing link. Each person can edit independently and share a new snapshot. There is no live collaboration, ownership verification, password protection, or individual link revocation in this feature.

# Configurable dinner title

Add a labeled **Dinner title** field to bill details. Its default is **Dinner bill**. Accept a single line of up to 120 Unicode characters; trim surrounding whitespace for display and use the default when the value is blank.

Show the configured title in the payment summary and the heading of both generated message tones. The product name remains Family Meal Splitter. Include the title in saved drafts and shared snapshots, and update the results and message immediately when it changes.

Existing saved bills without a title migrate to the default without losing their other values. Reset restores the default title and follows the existing confirmation behavior. A custom title counts as entered data when deciding whether Reset or Load Example Dinner needs confirmation.

# Sharing flow and privacy choice

Provide a prominent **Share dinner** action separate from **Copy Message**. Every activation opens a privacy dialog before generating or copying a link.

Offer two clearly labeled choices:

- **Use children’s initials**, selected by default each time the dialog opens.

- **Keep names as entered**, which includes the full contents of the children’s name fields.

Both choices include children’s ages. Only children’s name fields are abbreviated; household names and the dinner title remain as entered. Show this distinction in the dialog, including when a household name or title might itself identify someone.

Use this disclosure, with equivalent concise wording permitted:

> This link includes the dinner title, household names, children’s ages, and either their names or initials. This app does not store dinner details on a server. Your browser saves your draft, and the link itself contains the snapshot. Anyone with the link can read its contents.

Also explain that initials do not guarantee anonymity, shared snapshots do not update automatically, and links cannot be individually revoked. Secondary help should explain that the configuration is encoded rather than encrypted and may remain in browser history or messages.

The dialog provides **Cancel** and **Copy share link**. Cancelling generates and copies nothing and changes no bill data. Copying uses the configuration currently displayed and the selected privacy choice. Report success only after the clipboard operation succeeds. If copying is unavailable, show a selectable link with manual-copy instructions.

Dinners without children still receive the sharing disclosure; make clear that there are no child names to abbreviate.

# Initials behavior

Replace each nonempty whitespace-separated part of a child’s name with its first Unicode letter or number followed by a period. Ignore punctuation-only parts. Preserve Unicode characters, handle surrounding and repeated whitespace, and keep already initialed names stable when shared again.

Examples use fictional names only:

- **Child A1** becomes **C. A.**

- **Child** becomes **C.**

Blank names retain the app’s normal unnamed-child fallback. Abbreviation changes the outgoing snapshot only; the sender’s editor and saved names remain unchanged.

An initials link must not contain a hidden original name in identifiers, metadata, or any other field. Identifiers must be opaque or regenerated without embedding names. A recipient can edit the initials manually, but choosing Keep names as entered cannot recover a full name that was not included in the received link.

Age, selected percentage, manual-override state, and household ordering remain unchanged. Ages continue to be excluded from the generated group text message in both tones.

# Snapshot contents and link format

A snapshot contains a format version, dinner title, total amount, message tone, ordered households, household names, adult counts, and each child’s chosen name or initials, age, selected percentage, and manual-override state. Preserve stable unique identifiers or regenerate them consistently on import. Preserve household order so penny-allocation ties remain deterministic.

Blank child ages round-trip as null. Blank names retain their existing display fallbacks. Do not include unrelated localStorage, credentials, hidden original names, or separately stored payment totals. Recalculate payments from the imported configuration using the existing exact-cent calculation engine.

Store the versioned, compact configuration in the URL fragment, after the hash, rather than the query string. Preserve the deployed repository base path. Dinner payloads therefore are not included in ordinary requests to GitHub Pages or standard referrer headers. The fragment still exists in the URL, browser history, and any message used to send it.

Internal navigation, including the logo and mobile View split action, must preserve the sharing payload. Editing does not continuously rewrite the incoming snapshot URL. Re-sharing creates a link from the current displayed state and opens the privacy dialog again.

Limit the complete generated and incoming share link to 8,000 characters and decoded UTF-8 snapshot data to 256 KiB. Version 1 uses uncompressed JSON and rejects compressed payloads; the complete-URL limit makes its effective decoded size much smaller than 256 KiB. Never truncate a snapshot or copy an incomplete link. Explain when a dinner is too large to share and suggest reducing included text or splitting the configuration. Sharing also has the field, entity, and nesting limits defined in Security requirements; these do not impose a fixed household count on the ordinary editor. Messaging services may impose lower link limits.

Link previews remain the app’s generic preview; a custom dinner title appears after the recipient opens the page.

# Recipient editing and local storage

A shared link opens immediately as an editable local copy. A first visit in a fresh browser shows the snapshot’s values, regardless of any ordinary saved dinner in that browser. Editing affects neither the sender nor another recipient.

Preserve two draft categories: the ordinary saved dinner and the single most recently edited shared dinner. Opening an unedited shared snapshot does not overwrite either saved draft. Once the recipient edits that shared dinner, save it as the most recently edited shared draft without changing the ordinary saved dinner.

When revisiting or refreshing the matching shared link in that browser, restore its local edits. A fresh browser sees the original snapshot. After a different shared dinner has been edited, an older link opens its original snapshot because only the most recent edited shared draft is retained. Explain this retention rule in the shared-dinner help.

Show a visible shared-copy notice explaining that edits stay on this device and require a new link to be sent to others. Distinguish an unchanged snapshot from a locally edited copy.

Provide **Reload original snapshot**, with confirmation before discarding local edits, and **Open my saved dinner**, which returns to the ordinary draft without overwriting it. Reset and Load Example Dinner affect the currently open local copy and retain their existing confirmation behavior.

Browser back/forward navigation and fragment changes must not unexpectedly replace an active edited bill. Handle intentional snapshot navigation consistently with the draft rules and confirm before an action would discard local edits. Storage failures must display an accurate warning while allowing in-memory editing and sharing.

# Validation and failure handling

Offer sharing only when there is at least one household and a valid bill calculation. A zero-dollar bill, including zero combined weight, is shareable. A nonzero bill requires positive total weight.

Validate decoded links defensively before rendering or persisting them. Reject unsupported versions, malformed encoding, missing required fields, invalid nested objects, invalid monetary amounts, duplicate identifiers, and values outside supported ranges. Adults are integers from 0 to 1,000; age is null or an integer from 0 to 17; percentages are integer multiples of five from 0 to 100; the override flag is boolean; the tone is supported; the title respects its limit.

Handle an invalid link with a clear message and an action to open the ordinary saved dinner. Do not partially import it, overwrite drafts, execute embedded HTML or scripts, or show NaN or Infinity.

Legacy local-draft migration is separate from share-link validation: migrate existing local bills without titles, but do not silently reinterpret an unsupported share-link version as legacy local data.

# Security requirements

## Trust boundaries

Treat every shared link, typed field, and restored local draft as untrusted, even when it came from this app. Anyone can author or alter a snapshot. The primary risks are script execution in the recipient’s browser, URL interpretation and redirects, unsafe object merging, forged text formatting, private-data leakage, and excessive parsing or rendering work. Static hosting removes a database and application-server execution path; it does not make browser input trusted.

Keep validation and safe output handling as separate controls, following [OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html). Passing validation does not authorize code execution, navigation, data access, or any other capability.

## URL construction and decoding

Version 1 uses exactly one fragment payload in the form `#share=v1.<base64url>`. The payload is uncompressed UTF-8 JSON encoded with unpadded Base64url. Version 1 does not accept compressed content. Require the supported version, correct alphabet and padding rules, valid UTF-8, and exact Base64url re-encoding; reject extra fragment parameters, repeated payload markers, trailing garbage, and malformed encodings.

Read the fragment once and use one defined Base64url, UTF-8, and JSON decoding pipeline. Do not repeatedly URI-decode or HTML-entity-decode input. Percent-looking text inside a validated name stays literal text. Browser URL APIs distinguish setting a fragment from decoding its content; see [MDN URL hash behavior](https://developer.mozilla.org/en-US/docs/Web/API/URL/hash).

Construct outgoing links with the browser URL API using this app’s trusted origin and configured GitHub Pages base path. Clear unrelated search parameters and the old fragment, then assign only the encoded snapshot. Never interpolate names, titles, or identifiers into the URL scheme, credentials, hostname, pathname, or query string. Characters such as ampersands, question marks, hashes, percent signs, slashes, and quotes inside text fields must round-trip as data and cannot introduce additional parameters.

Ignore query parameters as a source of dinner state or navigation commands. No payload or query field may supply a redirect, return URL, fetch destination, asset path, script source, or dynamically selected storage key.

## Schema and object safety

Parse JSON as data only, then construct a new application object by explicitly copying validated fields. Never evaluate payload text, spread the parsed object into component props or application configuration, recursively merge arbitrary properties, or dynamically assign imported keys to ordinary JavaScript objects.

Document and validate the exact version 1 schema. Require non-null objects where objects are expected, arrays where arrays are expected, and own properties with the specified types. Reject unknown object fields, including keys such as `__proto__`, `prototype`, and `constructor`. Those words remain valid as ordinary name values and must not be rejected merely because they occur in display text. Use fixed field names and Map or Set for keyed collections, consistent with [MDN prototype pollution defenses](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution).

Require the exact supported version; tone is exactly `fun` or `simple`; the override flag is boolean. Retain the existing numeric rules, safe-integer checks, USD amount limit, positive-weight requirement for nonzero bills, unique identifiers, and ordered allocation. Do not coerce strings into numbers or accept nonfinite values. A JSON number written with an exponent is evaluated by its numeric value and the same bounds; an exponent-form amount string is not valid USD input.

For sharing, each household and child name is at most 120 Unicode characters; the title retains its 120-character limit. Shared identifiers must be unique ASCII letters, digits, underscores, or hyphens, 1–80 characters long. Export must regenerate identifiers without using incoming names or original identifiers, so an initials-only export cannot hide original names in IDs. The maximum number of shared entities is 200, counting households plus children. Maximum container nesting depth is eight. These are sharing limits, not a new fixed household limit in the ordinary editor.

Validate single-line names and titles after JSON decoding. Reject C0/C1 control characters, U+2028, U+2029, and explicit bidi override/isolate controls U+202A–U+202E and U+2066–U+2069. Reject ill-formed Unicode scalar text. Preserve ordinary multilingual letters, combining marks, apostrophes, hyphens, emoji, and punctuation. Directional isolation in rendering must support normal right-to-left names. These controls reduce injected message lines and direction tricks; they do not prove authenticity or eliminate every visual deception.

## Safe rendering and copied text

Render names, titles, notices, and validation errors only as React text children or safe input values. Do not route them through raw HTML, Markdown rendering, SVG markup, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, dynamically constructed functions, inline event handlers, CSS, or URL-valued attributes. Generate DOM IDs and label relationships from safe internal identifiers rather than names. Progress widths come only from validated numeric values.

Use safe text sinks rather than dangerous-string blacklists, as described by [OWASP DOM XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html). A bounded name resembling an HTML tag or a URL may be displayed literally; it must create no attacker-supplied element, handler, link, navigation, or network request.

Copy messages with the plain-text clipboard API. Do not create HTML clipboard content or auto-link names. Only the application generates message line breaks. Third-party messaging apps may independently auto-link or format copied text; this app cannot guarantee their behavior.

## Resource limits and safe failure

Apply the 8,000-character complete-URL limit on both incoming and outgoing share links before decoding. Enforce the 256 KiB decoded-byte ceiling before JSON parsing, with bounded traversal and simple bounded-time validation. The URL limit makes the effective version 1 decoded size much smaller than 256 KiB. Reject compressed payloads, excessive nesting, excessive entities, oversized fields, and unsupported structures without recursive processing that can exhaust the call stack. Do not use patterns vulnerable to excessive backtracking on attacker-controlled text.

Restore local drafts through structural and resource validation, separately from the stricter share-valid calculation rules. Preserve bounded incomplete or invalid amount text while a person is editing; do not reject an entire draft solely because its bill amount is temporarily invalid. Bound the serialized content of each fixed local draft slot to 1 MiB before parsing or writing. If a draft exceeds this persistence limit, keep in-memory editing available, warn that the changes cannot be saved, and preserve the last saved value.

Malformed links, corrupt persisted values, unsupported versions, and failed writes must never trigger an initialization effect that replaces an existing draft with an empty bill. Leave rejected stored values untouched until a deliberate recovery or reset action. Import is atomic: validation and calculation succeed before a valid shared copy can be persisted, and the ordinary saved dinner is never overwritten by loading a link.

Use two fixed, app-namespaced storage keys: the ordinary draft and the most recently edited shared draft. A bounded digest of the validated incoming snapshot may identify the shared draft inside the second record, but it is not an arbitrary storage-key name or a security signature. The app reads and writes only its own documented keys.

## Confidentiality and integrity boundaries

Retain the explicit privacy dialog before generating or copying a link. Loading a received link validates and opens it immediately for editing; it does not require a second sharing-consent dialog. Initials transformation must remove the original child-name values before serialization. Version 1 rejects unknown fields and serializes only explicitly allowed values; never copy unrelated browser data.

Do not log or transmit dinner names, ages, titles, full shared URLs, fragment contents, decoded payloads, or local drafts to analytics, telemetry, crash reporting, or external shortening services. Do not reflect a raw malformed payload in an error message. Normal same-origin app assets may load, but imported content must not induce external requests, dynamic resource loads, or navigation.

A fragment prevents ordinary hosting requests from containing the payload; it is not encryption or access control. A person with the link can read and alter it. Recomputed payments prevent inconsistent arithmetic but cannot establish who authored a link or whether the source bill is genuine. Do not add a client-side secret signing key or claim that a checksum or digest authenticates the sender.

Local storage is unencrypted and readable by scripts on the same origin. GitHub Pages project paths under `derrick-tao.github.io` share an origin; app-specific key names do not isolate their data from other apps on that origin. Document this limitation without claiming server storage or authenticated browser privacy. A dedicated origin would require a separate hosting/domain decision. These boundaries follow [OWASP browser storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## Production defense in depth

Verify a production Content Security Policy compatible with the static export. On GitHub Pages, use an early meta policy for supported directives rather than assuming custom response headers or middleware are available. Restrict executable and fetched resources to required application sources; prohibit objects, base-URL injection, frames loaded by the app, form submission, and `unsafe-eval`. Allow required Next.js inline hydration scripts only through build-derived hashes; do not silently enable `script-src 'unsafe-inline'` to pass tests. Account separately for the app’s inline numeric progress styles without treating their allowance as permission for inline scripts.

CSP is an additional safeguard, not a replacement for safe rendering and validation. Test the final exported policy and hydration in a real browser. A meta policy cannot supply `frame-ancestors` protection or configure HSTS; do not claim those protections unless the host actually supplies the relevant headers. See [MDN Content Security Policy guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

Record the security review findings and test outcomes before release. Resolve exploitable findings in the snapshot parser, object construction, text rendering, URL creation, and storage paths before deployment. This requirements review is not a completed penetration test or a guarantee of zero vulnerabilities.

# Acceptance criteria

1. A title updates the payment summary and both message tones immediately, survives refresh and sharing, defaults correctly when blank, and resets with confirmation. Older saved bills retain all existing values after migration.

2. An independent browser opening a generated example snapshot reproduces Family A $62.67, Family B $40.44, Family C $90.98, Family D $60.65, and the exact $254.74 total.

3. Both privacy modes retain ages, percentages, override flags, and order. Initials sharing does not mutate sender names and contains no hidden original child names. Repeated initials sharing is stable.

4. A recipient can change Child A2 from 30% to 50% and obtain $68.58, $39.19, $88.18, and $58.79. The message changes immediately, omits ages, and copied text matches its preview.

5. Sender edits leave old links unchanged. Recipient edits do not change the sender’s bill. A newly shared link reproduces the recipient’s revised state in another browser.

6. The ordinary saved dinner remains recoverable. Refresh restores the most recently edited shared copy when its link matches. Editing another shared dinner follows the documented retention rule. Reload original snapshot requires confirmation before discarding edits.

7. Unicode, single-part names, repeated whitespace, punctuation, already initialed names, empty names, null ages, households without children, multiple adults, zero-percent children, and zero-dollar dinners behave consistently.

8. Corrupt and unsupported links, invalid nested values, duplicate identifiers, size-limit failures, and clipboard/storage failures produce useful messages without losing existing drafts or falsely reporting success.

9. The logo, View split, Reset, browser history, and shared-link navigation preserve or intentionally handle snapshot state. The deployed GitHub Pages subpath loads all required assets.

10. Desktop and narrow-mobile layouts remain usable without horizontal scrolling. The sharing dialog supports labeled controls, keyboard navigation, focus management, Escape/cancel behavior, and clear success/error feedback.

All existing calculation and primary-flow tests must continue to pass. Add focused unit tests for title migration, initials, codec validation and round-trips, draft precedence, and the security acceptance criteria, plus browser tests using separate sender and recipient contexts. Run formatting, lint, TypeScript, unit tests, browser tests, and the production GitHub Pages export. Verify the hosted site and its actual production CSP after deployment; document security findings and do not release an exploitable input-handling path.

# Security acceptance tests

- Exercise malicious-looking inputs in dinner titles, household names, and child names through direct typing, hand-crafted links, and persisted drafts. Include script tags, image/SVG event-handler markup, quotes, attribute-like text, `javascript:`, `data:`, protocol-relative URLs, ampersands, hashes, question marks, percent escapes, and encoded variants. Accepted values remain literal text; they create no attacker-supplied DOM element, script execution, additional URL parameter, navigation, or payload-induced network request.

- Verify one-pass decoding: a name containing literal percent escapes, HTML entities, or literal backslash-u text is never decoded a second time. Reject actual decoded control and bidi characters after JSON parsing. Preserve legitimate multilingual names, combining marks, emoji, apostrophes, and hyphens.

- Reject malformed Base64url, invalid UTF-8, extra or repeated fragment markers, unsupported versions, compressed payloads, trailing garbage, wrong root types, nested nulls, missing and unknown keys, prototype-related object keys, duplicate identifiers, invalid enums/booleans, type-coercion attempts, unsafe numbers, invalid USD strings, and unsupported nested shapes. Test dangerous-key strings separately as harmless name values.

- Test boundaries immediately below, at, and above URL, byte, field-length, nesting, and entity limits. Very long or deeply nested hostile inputs fail safely without UI lockup, stack exhaustion, truncation, or partial import.

- Before malformed-link and corrupted-storage tests, seed both draft slots with known values. Assert they remain byte-for-byte unchanged after rejection. Assert an unrelated same-origin storage key is untouched. Test quota/write failures and ensure bounded invalid amount text still restores as an editable draft.

- For initials sharing, inspect decoded outgoing data as well as rendered content: no original child-name copy may remain in IDs, unknown fields, metadata, or a cached original-name field. Ages, percentages, overrides, household order, and exact cent totals remain correct.

- In browser tests, monitor script execution, inserted elements, navigation, and resource requests. Permit expected same-origin assets; assert imported content cannot select request destinations. Clipboard text matches the preview and has no injected application-created HTML.

- Verify the exported production CSP permits required hydration and styling, blocks injected scripts and disallowed resources, and does not rely on unsupported meta directives. Recheck the live GitHub Pages subpath, mobile editing, share-dialog consent, navigation, local draft restoration, and all financial regression tests.

# Review and implementation approval

Independent requirements and security reviews resolved local-draft precedence and retention, hidden full-name leakage, safe one-pass decoding, explicit schema construction, text-only rendering, resource limits, fragment navigation, and storage recovery without data loss. No further user clarification is needed for the draft. These are requirements and design reviews; security verification of the implemented feature remains a release requirement.

The behavior specified above includes implementation defaults for approval: 120-character dinner titles and shared name fields, initials selected by default on every share, children’s ages retained in both modes, an 8,000-character complete-URL limit, uncompressed version 1 snapshots, a 256 KiB decoded ceiling, 200 shared households-plus-children, nesting depth eight, a 1 MiB serialized limit per local draft slot, and retention of the ordinary draft plus the most recently edited shared draft. Resource-limit failures preserve existing saved values and never silently truncate data.

The user has approved coding, automated validation, and updating the existing Family Meal Splitter GitHub repository and Pages deployment within this scope. Commit and push follow separate code review, fixes, and fresh browser verification with screenshots reviewed by the coordinating agent.
