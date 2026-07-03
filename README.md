# SN Dev Helper

A Manifest V3 Chrome extension of developer utilities for ServiceNow, in the
spirit of snUtils. Plain JavaScript, zero runtime dependencies, zero build step.

> Proof of concept, coded entirely with the help of AI.

## What it does

- Instance info at a glance in the toolbar popup.
- A `\` **command palette** on any ServiceNow tab for navigation, record
  helpers, and toggles.
- Technical **field-name badges** and **translation icons** on classic forms.
- A best-effort **Debug Timeline** recorder for `g_form` calls, field events,
  GlideAjax timing, and JavaScript errors.

---

## Install from the repository zip

The extension is not on the Chrome Web Store — you load it "unpacked" from a
folder on your PC. This is a one-time setup; after that you just reload it when
there's a new version.

### 1. Download the zip

1. Open the repository page: <https://github.com/sasukepatel/sndevhelper>
2. Click the green **Code** button near the top of the file list.
3. Choose **Download ZIP**. Your browser saves something like
   `sndevhelper-main.zip` to your Downloads folder.

   Direct link:
   <https://github.com/sasukepatel/sndevhelper/archive/refs/heads/main.zip>

### 2. Extract it to a permanent location

Chrome loads the extension **from the folder, not the zip**, and it re-reads
that folder every time Chrome starts. So put it somewhere stable that you won't
delete or move — **do not leave it in Downloads or a temp folder.**

A good home on Windows is a dedicated folder in your user profile, for example:

```
C:\Users\<you>\ChromeExtensions\SnDevHelper
```

To extract:

1. Right-click the downloaded `.zip` → **Extract All…**
2. Set the destination to your permanent folder (e.g.
   `C:\Users\<you>\ChromeExtensions\`) and extract.
3. Open the extracted folder. GitHub zips wrap everything in an inner folder
   (e.g. `sndevhelper-main`). Make sure you can see
   **`manifest.json`** directly inside the folder you plan to load — that file
   must sit at the top level of the folder you point Chrome at.

> Tip: if the folder you extracted contains a single sub-folder and that
> sub-folder holds `manifest.json`, load the sub-folder.

### 3. Load it in Chrome

1. Open Chrome and go to `chrome://extensions` (paste it into the address bar).
2. Turn on **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** (top-left).
4. Browse to the folder that contains `manifest.json` and click **Select
   Folder**.
5. "SN Dev Helper" now appears as a card in your extensions list.

### 4. Pin it (optional but recommended)

Click the puzzle-piece **Extensions** icon in the Chrome toolbar, then the pin
next to **SN Dev Helper** so its icon stays visible.

### Updating to a newer version

1. Download and extract the new zip **into the same folder**, replacing the old
   files (or extract fresh and re-point Chrome at the new folder).
2. Go to `chrome://extensions` and click the **reload** (↻) icon on the SN Dev
   Helper card.
3. Refresh any open ServiceNow tab so the updated content script loads.

### Troubleshooting

- **"Manifest file is missing or unreadable"** — you pointed Chrome at the wrong
  folder. Select the folder that directly contains `manifest.json`.
- **Icon/popup does nothing on a page** — the extension only activates on
  `*.service-now.com` URLs. Open a ServiceNow instance first.
- **Toggles or badges disappeared after the form changed** — toggles are manual
  and don't re-apply after a form re-renders; run the toggle again.

---

## Using the extension

### Keyboard shortcuts

| Shortcut | What it does |
| --- | --- |
| `Ctrl+Shift+K` (`Cmd+Shift+K` on Mac) | Open the toolbar popup |
| `\` (backslash) | Open the command palette on the current ServiceNow tab |
| `Alt+Shift+F` | Toggle technical field names on the current form |

The popup shows detected instance information. Almost all actions live in the
`\` command palette — start typing to filter, use arrow keys and `Enter` to run,
and `Esc` to close. Some commands accept an argument in an inline input field.

### Command palette commands

**Tools**

| Command | Description |
| --- | --- |
| Toggle field names | Show/hide technical field names (`label.<table>.<field>`) as badges next to form labels. Also bound to `Alt+Shift+F`. |
| Toggle translation icons | Show/hide per-label icons: a globe for `sys_documentation` (label/plural/hint) and a languages glyph for `sys_translated_text` (per-record value translations). |
| Start / Stop debug timeline | Record a single page's `g_form` calls, native field events, GlideAjax timing, and JavaScript errors, then view a filterable results panel. Best-effort; does not promise named Client Script / UI Policy attribution. |

**Record**

| Command | Description |
| --- | --- |
| Copy sys_id | Copy the current record's `sys_id` to the clipboard. |
| Open playbook executions | Open Process Automation playbook executions for the current record. |
| Open current playbook customer updates | On a playbook (process definition) page, open the related `sys_update_xml` customer updates. |
| Open customer updates by sys_id… | Enter a record sys_id or ServiceNow URL to open its customer updates. |

**Catalog**

| Command | Description |
| --- | --- |
| Prefill variables from ticket… | Enter a RITM/SCTASK/REQ/task number (or submitted-record sys_id) to prefill portal catalog variables from that ticket. |
| Copy portal variable debug info | Copy diagnostic details about the current portal record's variables/fields. |

**Navigate**

| Command | Description |
| --- | --- |
| Open table list… | Enter a table name (e.g. `incident`) to open its list view (`<table>_list.do`). |
| Open new record… | Enter a table name to open a new record form (`<table>.do?sys_id=-1`). |

**Dev Links** — one-click navigation to common developer destinations:
Background Scripts, Script Includes, Business Rules, Client Scripts, UI Actions,
System Logs, Update Sets, Scheduled Jobs, Fix Scripts, Sys Properties, REST
Explorer, and Flow Designer.

---

## For developers

- Load unpacked as above; after editing, click **reload** on the extension card,
  and refresh the ServiceNow tab for content-script changes.
- Package for the Chrome Web Store: `bash package.sh` (produces a clean zip with
  only the files Chrome needs).

See [CLAUDE.md](CLAUDE.md) for architecture notes (the two JS worlds, frames,
and message flow).
