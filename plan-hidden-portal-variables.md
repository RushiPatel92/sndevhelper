# Command palette: "Show hidden variables" on Service Portal catalog items

## Context

The user wants a way to inspect variables on a catalog item they're currently
filling out in Service Portal that aren't visible on the form — both
permanently-hidden variables (ServiceNow's "Hidden" question type) and
variables temporarily switched off by a UI Policy / catalog client script.
Triggered on demand from the command palette, since toggles here don't
persist across re-renders and a one-shot inspection fits this project's
existing "best-effort debug tool" pattern (Debug Timeline, portal variable
debug copy).

Clarified with the user:
- "Hidden" = both permanent Hidden-type variables and anything currently
  switched off by UI Policy/client script.
- Output = a **read-only inspection panel** (name/label + best-effort current
  value), not forcing the live Angular form to reveal real editable fields.
  Forcing live fields was rejected as too fragile against Angular's digest
  cycle and unnecessary for a debugging tool.

This reuses three already-solved pieces of this codebase rather than
reinventing them:
- `currentCatalogItemDefinitionSysId()` (content.js:1007) / its MAIN-world
  twin `currentCatalogItemSysId()` (background.js:190) already resolve the
  catalog item's sys_id from an **unsubmitted** portal page (URL `sys_id`
  param, then `[cat-item-sys-id]`/`[data-item-sys-id]`/`[data-sys-id]` DOM
  attributes).
- `applyVariableSetPlacementOrder()` (content.js:1029) already queries
  `io_set_item` by `sc_cat_item=<id>^variable_setIN<ids>` — confirms the
  table/field shape needed to resolve a catalog item's variable-set
  membership.
- `findDomField(variable)` (background.js:1287) + `getElementValue(el)`
  (background.js:372) are an already-built, tested variable → DOM element
  resolver and value reader, built for `fillPortalVariables`. Reusing these
  for *reading* visibility/value is far more robust than inventing new
  `ng-hide`-class DOM sniffing. Note ServiceNow's own docs flag
  `g_form.isVisible()` as unreliable specifically in Portal view, so DOM
  `offsetParent !== null` is the authoritative visibility signal; `g_form`
  visibility is captured only as supplementary/informational data.
- `fetchProducerVariables` (content.js:661) is **not** reusable here — it
  reads `question_answer` rows that only exist after a Record Producer has
  already created a target record. It's irrelevant to an in-progress,
  unsubmitted catalog item's variable *definitions*, so don't extend it.

## Three-bucket hidden-variable detection

For each variable defined on the catalog item (from Table API, independent
of DOM state):

- **Bucket A — permanent "Hidden" type.** Detected via
  `normalizeVariableType()` (content.js:545) applied to the *display value*
  of `item_option_new.type` (fetched with `displayAll:true`, already this
  file's convention) checked against `"hidden"`. Do not hardcode a numeric
  type code — verify the actual display string against a live instance
  during implementation/testing.
- **Bucket B — present in DOM, currently invisible.** `findDomField(variable)`
  resolves an element; `el.offsetParent === null`. Read live value via
  `gForm.getValue(key)` (through `variableKeys(variable)`,
  background.js:954) first, falling back to `getElementValue(el)`.
- **Bucket C — absent from DOM entirely** (variable-set condition false,
  `ng-if` false, wrong tab/category). No element found. Try
  `gForm.getValue(key)` anyway (Angular model can retain a value after
  `ng-if` removal), else fall back to the Table API `default_value`, clearly
  labeled `(default, not live)`.

Structural noise types (`container`/`container_end`/`container_start`/
`label`/`macro`/`rich_text_label` — everything in `UNSUPPORTED_VARIABLE_TYPES`
except password/encrypted) are excluded entirely, matching how prefill
already treats them.

**Redaction:** `password`/`encrypted` types and any variable whose
name/label matches a sensitive-name pattern (reuse the regex from
`debug_timeline_main.js:46`) are kept in the list (knowing a hidden password
field exists is useful) but the value is forced to `[REDACTED]` **at the
source** — background.js never calls `getElementValue`/`gForm.getValue` for
them, content.js never populates their `default_value` — so the secret never
crosses the `chrome.runtime.sendMessage` boundary.

## Implementation

**`content.js`** (isolated world), near the existing catalog-variable code
(~line 660-1160):
- `isHiddenVariableType(type)`, `isSecretVariableType(type)` — small helpers
  in the style of `isAttachmentVariableType`/`isMultiRowVariableSetType`.
- `fetchCatalogItemVariableDefinitions(catalogItemSysId)` — new fetch (not a
  reuse of the answer-centric `normalizeSourceVariable`/
  `addVariablesFromRows`, which silently drop variables with an empty
  value — wrong here since we want every definition):
  1. `item_option_new` where `cat_item=<id>` →
     `sys_id,name,question_text,type,order,variable_set,reference,lookup_table,list_table,default_value`.
  2. `io_set_item` where `sc_cat_item=<id>` → `variable_set,order` (same
     shape as `applyVariableSetPlacementOrder`).
  3. If sets found: `item_option_new` where `variable_setIN<ids>` with the
     same field list.
  4. Merge into a `Map` keyed by name; drop structural types; redact secret
     types immediately (blank `default_value`, `redacted:true`).
- `showHiddenPortalVariables()` — new palette command handler: resolve
  `catalogItemSysId` via `currentCatalogItemDefinitionSysId()` (toast + abort
  if missing) → fetch definitions (toast + abort if empty) → send
  `{ type: "GET_HIDDEN_PORTAL_VARIABLES", catalogItemSysId, variables }` to
  background → classify into buckets → if nothing hidden, toast a positive
  "no hidden variables found" result → otherwise call
  `SNHiddenVariablesUI.showResults(...)` then `closePalette()` (mirrors the
  `stop-debug-timeline` pattern at content.js:1525-1531).
- New entry in `buildCommands()` (~content.js:1490), in the `"Catalog"`
  group after `copy-portal-variable-debug`:
  ```js
  {
    id: "show-hidden-variables",
    name: "Show hidden variables",
    keywords: ["hidden", "variable", "catalog", "ui policy", "client script", "variable set", "sc_cat_item"],
    group: "Catalog",
    keepOpen: true,
    run: showHiddenPortalVariables,
  }
  ```

**`background.js`** (MAIN-world), near `inspectPortalVariableDebug`
(~line 2013):
- `inspectHiddenPortalVariables(variables)` — new self-contained MAIN-world
  function (must duplicate, not import, needed helpers, since
  `executeScript({func})` only serializes that one function — this matches
  the existing convention for `fillPortalVariables`/`inspectPortalVariableDebug`):
  `isGForm`, `getAngular`, `findPortalGForm`/`scoreGForm`/`findGFormsInObject`
  (copy from background.js:185-358), `currentCatalogItemSysId`,
  `normalizeComparable`/`sameValue`, `variableKeys`, `findDomField`,
  `getElementValue`, `visibleText`, `hasPortalFormContainer`, plus a new
  `isElementVisible(el) { return el.offsetParent !== null; }`. Skip secret
  variables entirely (never touch DOM/gForm for them). Return
  `{ foundForm, matchedCount, results: [{name, foundEl, visible, liveValue, liveValueAvailable, gFormReportedVisible}] }`.
- New handler in the existing `chrome.runtime.onMessage` block
  (~background.js:2432, after `GET_PORTAL_VARIABLE_DEBUG`) for
  `GET_HIDDEN_PORTAL_VARIABLES`: `executeScript({allFrames:true, world:"MAIN", func: inspectHiddenPortalVariables, args:[variables]})`,
  pick the frame result with the highest `matchedCount` (mirrors
  `FILL_PORTAL_VARIABLES`'s "score frames, pick best" pattern rather than
  `GET_PORTAL_VARIABLE_DEBUG`'s "dump every frame" pattern, since this needs
  one merged verdict per variable), respond
  `{ ok, foundForm, perVariable }`.

**New file `hidden_variables_ui.js`** (isolated world), structurally mirrors
`debug_timeline_ui.js`: IIFE guarded by
`if (globalThis.SNHiddenVariablesUI) return;`, reuse its visual language
(`.overlay`, `.panel`, `.header`, `.best-effort` badge, `.summary`,
`.controls`, `.filters`/`.filter`, search box) in a closed-shadow host
(`#snh-hidden-variables-results`), Escape/overlay-click to close, a "Copy
list" button reusing the `navigator.clipboard.writeText` + `execCommand`
fallback pattern from `copyTrace()`. `showResults(result)` renders: header +
best-effort badge, summary counts per bucket (+ a warning if `!foundForm`),
filter chips per bucket, search-by-name/label, rows with label/name/type
badge/bucket badge/value (or `[REDACTED]` italic, or `(default, not live)`
tag), footer note "Read-only inspector — does not modify the live form."
Export `globalThis.SNHiddenVariablesUI = { showResults }`.

**`manifest.json`**: add `"hidden_variables_ui.js"` to `content_scripts[0].js`,
before `content.js` (same load-order rule as `debug_timeline_ui.js`):
`["debug_timeline_ui.js", "hidden_variables_ui.js", "content.js"]`.

`package.sh` needs no change (allowlist-by-exclusion picks up new files
automatically).

## Assumptions to verify against a live instance during implementation

1. The exact display string ServiceNow returns for the "Hidden" question
   type via `sysparm_display_value=all` on `item_option_new.type`.
2. `item_option_new.default_value` semantics for non-text variable types
   (choice/date/reference encoding).
3. `g_form.isVisible()`/`getField().visible` reliability in Portal — treated
   as supplementary only, per the plan above.
4. `findDomField`'s resolution quality for variables inside a currently
   hidden multi-row variable set (acceptable fallback: bucket C, no live
   value).
5. Frame-picking correctness on a real Service Portal page with any embedded
   widget iframes — same pre-existing caveat as sibling portal features, not
   a new risk.

## Verification

1. Load the unpacked extension, open a Service Portal catalog item that has
   at least one Hidden-type variable and one variable behind a UI Policy
   condition (e.g. a "show if X" checkbox left unchecked).
2. Open the command palette (`` ` ``), run "Show hidden variables".
3. Confirm the panel lists both the Hidden-type variable and the UI-Policy
   variable, with correct bucket labeling.
4. Toggle the UI Policy condition live (e.g. check the box) and re-run the
   command; confirm the variable drops out of the hidden list once visible.
5. Test on a plain catalog item with nothing hidden — confirm the
   "no hidden variables found" toast path.
6. If a password-type or sensitively-named hidden variable is available,
   confirm its value renders as `[REDACTED]` in the panel.
7. Confirm the panel closes on Escape/overlay click and "Copy list" copies
   readable text to the clipboard.

