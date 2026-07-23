# Changelog

All notable changes to SN Dev Helper are recorded here. The version is the one
in [`manifest.json`](manifest.json); bump it in the same change that adds an
entry below.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Dates are `YYYY-MM-DD` (Europe/London). Releases before 0.4.0 were not tagged
individually, so 0.3.0 is recorded as a single baseline rather than
reconstructed version by version.

## [0.5.0] - 2026-07-23

### Added
- **"What affects this catalog item"** command. A read-only panel listing the
  catalog client scripts (`catalog_script_client`) and catalog UI policies
  (`catalog_ui_policy`) bound to the current Service Portal item or its variable
  sets — script type, watched variable, active state, and which views they run
  on — each row a click-through to the platform record. All reads are
  same-origin Table API GETs; script bodies are never shown, so no new
  permissions and nothing to redact.

## [0.4.0] - 2026-07-23

### Added
- Extension icons at 16/32/48/128px, declared as both the top-level `icons`
  and `action.default_icon`. Chrome previously showed the generic puzzle-piece
  placeholder, so pinning the extension pinned a blank icon.

### Changed
- **Field-name badges and translation icons now survive a classic form
  re-render.** A `MutationObserver` re-applies whichever toggles are on after a
  section switch, related-list refresh, or UI Policy run, instead of the badges
  silently vanishing until you toggled again. Classic UI only; Agent Workspace
  forms still decorate on demand.
- `package.sh` now builds from an explicit allowlist and cross-checks the zip
  against every file `manifest.json` references, instead of shipping everything
  it was not told to exclude. This stops stray dev files (plan docs, agent
  configs) from landing in the distributable and fails the build if a
  manifest-referenced asset is left out.

### Removed
- Stale `plan-hidden-portal-variables.md`; that feature shipped in 0.3.0.

### Internal
- Added `.gitignore` (build artifact, local `memory/`) and `.gitattributes`
  pinning `*.sh` to LF so a fresh Windows clone does not get a CRLF
  `package.sh`.

## [0.3.0] - baseline

The feature set as of the first recorded version:

- Toolbar popup with detected instance info.
- `\` command palette on any ServiceNow tab: navigation, record helpers,
  toggles, and dev links.
- Technical field-name badges and translation icons on classic forms
  (`Alt+Shift+F` for field names).
- Best-effort Debug Timeline recorder for `g_form` calls, native field events,
  GlideAjax timing, and JavaScript errors.
- Portal catalog tools: prefill variables from a ticket, show all variable
  values (incl. hidden and variable-set variables), copy variable debug info.
- Record tools: copy sys_id, open playbook executions, open customer updates.

[0.5.0]: https://github.com/RushiPatel92/sndevhelper/releases/tag/v0.5.0
[0.4.0]: https://github.com/RushiPatel92/sndevhelper/releases/tag/v0.4.0
