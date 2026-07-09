/*
 * Isolated-world UI for the "Show hidden variables" command.
 * Loaded before content.js so the command-palette action can call the
 * public API. Read-only inspector — never modifies the live form.
 */

(() => {
  if (globalThis.SNHiddenVariablesUI) return;

  let resultsHost = null;
  let resultsShadow = null;
  let resultsKeydownHandler = null;
  let lastResult = null;
  let activeFilter = "all";
  let searchQuery = "";

  const BUCKET_LABELS = {
    "hidden-type": "Hidden type",
    invisible: "Hidden by policy/script",
    absent: "Not rendered",
  };

  const UI_CSS = `
    *{box-sizing:border-box}
    :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    button,input{font:inherit}
    .overlay{
      position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.52);
      display:flex;align-items:center;justify-content:center;padding:24px;
    }
    .panel{
      width:min(860px,calc(100vw - 32px));height:min(680px,calc(100vh - 40px));
      display:flex;flex-direction:column;overflow:hidden;
      background:#1e1e2e;border:1px solid #3a3a5c;border-radius:12px;
      box-shadow:0 28px 80px rgba(0,0,0,.65);color:#dedeee;
    }
    .header{
      display:flex;align-items:flex-start;gap:14px;padding:18px 20px 14px;
      border-bottom:1px solid #2e2e4e;
    }
    .heading{flex:1;min-width:0}
    h2{font-size:17px;line-height:1.2;margin:0 0 5px;color:#f5f5ff;font-weight:650}
    .subtitle{font-size:12px;color:#85859f;line-height:1.45}
    .best-effort{
      display:inline-flex;margin-left:7px;padding:3px 7px;border-radius:999px;
      color:#c7b9ff;background:#302b50;border:1px solid #4a4271;
      font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
      vertical-align:2px;
    }
    .close{
      border:0;background:transparent;color:#85859f;padding:3px 5px;
      font-size:12px;line-height:1;cursor:pointer;border-radius:5px;
    }
    .close:hover{color:#fff;background:#2d2d48}
    .summary{
      display:flex;gap:18px;align-items:center;padding:10px 20px;
      border-bottom:1px solid #292944;color:#aaaac1;font-size:11px;
    }
    .summary strong{color:#f0f0fa;font-size:13px;margin-right:4px}
    .warning{margin-left:auto;color:#d2b779}
    .controls{
      display:flex;align-items:center;gap:8px;padding:10px 14px;
      border-bottom:1px solid #292944;
    }
    .filters{display:flex;gap:6px;flex-wrap:wrap}
    .filter{
      border:1px solid #3a3a5c;background:#292941;color:#9898b2;
      border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px;
    }
    .filter:hover{background:#343453;color:#fff}
    .filter.active{background:#373766;border-color:#6262a1;color:#fff}
    .search{
      margin-left:auto;width:230px;max-width:38vw;background:#151522;
      border:1px solid #353553;border-radius:6px;color:#e5e5f4;
      outline:none;padding:7px 9px;font-size:12px;
    }
    .search:focus{border-color:#6767aa}
    .search::placeholder{color:#64647b}
    .rows{flex:1;overflow:auto;padding:6px 0}
    .row{
      display:grid;grid-template-columns:1fr 130px 140px 1fr;gap:12px;
      align-items:center;padding:10px 18px;border-bottom:1px solid #292941;
      font-size:12px;color:#d7d7e8;
    }
    .row-name{min-width:0}
    .row-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f0f0fa}
    .row-var{
      font:11px ui-monospace,SFMono-Regular,Consolas,monospace;color:#85859f;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .row-type{color:#9898b2;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .badge{
      justify-self:start;padding:3px 7px;border-radius:4px;font-size:10px;
      color:#aeb0d4;background:#2c2d4a;border:1px solid #3c3e62;white-space:nowrap;
    }
    .badge.hidden-type{color:#ffb1b1;background:#432a36;border-color:#684050}
    .badge.invisible{color:#a9d5ff;background:#24364a;border-color:#365573}
    .badge.absent{color:#b5e4c2;background:#263b35;border-color:#39594d}
    .row-value{
      min-width:0;font:11px ui-monospace,SFMono-Regular,Consolas,monospace;color:#c1c1d6;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .row-value.redacted{color:#ff9d9d;font-style:italic}
    .value-tag{color:#75758c;font-style:italic;margin-left:6px}
    .empty{padding:48px 20px;text-align:center;color:#74748b;font-size:13px}
    .toolbar{
      display:flex;align-items:center;gap:8px;padding:11px 14px;
      border-top:1px solid #2e2e4e;background:#1b1b2b;
    }
    .toolbar-note{font-size:11px;color:#67677e;flex:1}
    .toolbar button{
      border:1px solid #3a3a5c;background:#292941;color:#d8d8ea;
      border-radius:6px;padding:6px 9px;cursor:pointer;font-size:12px;
    }
    .toolbar button:hover{background:#343453;color:#fff}
    .toolbar .primary{background:#4b4b91;border-color:#6565b5;color:#fff}
    .toolbar .primary:hover{background:#5959a5}
    @media(max-width:640px){
      .overlay{padding:8px}.panel{width:100%;height:calc(100vh - 16px)}
      .header{padding:14px}.summary{padding:9px 14px;gap:10px;flex-wrap:wrap}
      .warning{width:100%;margin-left:0}.controls{align-items:stretch;flex-direction:column}
      .search{width:100%;max-width:none;margin-left:0}
      .row{grid-template-columns:1fr;gap:4px;padding:10px 14px}
    }
  `;

  const closeResults = () => {
    if (resultsKeydownHandler) {
      window.removeEventListener("keydown", resultsKeydownHandler, true);
      resultsKeydownHandler = null;
    }
    if (resultsHost) resultsHost.remove();
    resultsHost = null;
    resultsShadow = null;
  };

  const rowSearchText = (row) =>
    [row.name, row.label, row.type, BUCKET_LABELS[row.bucket] || row.bucket]
      .join(" ")
      .toLowerCase();

  const filteredRows = () => {
    const rows = (lastResult && lastResult.rows) || [];
    return rows.filter((row) => {
      if (activeFilter !== "all" && row.bucket !== activeFilter) return false;
      return !searchQuery || rowSearchText(row).includes(searchQuery);
    });
  };

  const valueCellText = (row) => {
    if (row.valueSource === "redacted") return "[REDACTED]";
    if (row.valueSource === "default") return (row.value || "") + " (default, not live)";
    if (row.valueSource === "live") return row.value || "(empty)";
    return "(no value)";
  };

  const renderRows = () => {
    if (!resultsShadow) return;
    const list = resultsShadow.querySelector(".rows");
    if (!list) return;
    list.textContent = "";

    const rows = filteredRows();
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No hidden variables match these filters.";
      list.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const el = document.createElement("div");
      el.className = "row";

      const nameCell = document.createElement("div");
      nameCell.className = "row-name";
      const labelEl = document.createElement("div");
      labelEl.className = "row-label";
      labelEl.textContent = row.label || row.name;
      labelEl.title = row.label || row.name;
      const varEl = document.createElement("div");
      varEl.className = "row-var";
      varEl.textContent = row.name;
      nameCell.append(labelEl, varEl);

      const typeCell = document.createElement("div");
      typeCell.className = "row-type";
      typeCell.textContent = row.type || "";
      typeCell.title = row.type || "";

      const bucketCell = document.createElement("span");
      bucketCell.className = "badge " + row.bucket;
      bucketCell.textContent = BUCKET_LABELS[row.bucket] || row.bucket;

      const valueCell = document.createElement("div");
      valueCell.className = "row-value" + (row.valueSource === "redacted" ? " redacted" : "");
      valueCell.textContent = valueCellText(row);
      valueCell.title = valueCell.textContent;

      el.append(nameCell, typeCell, bucketCell, valueCell);
      list.appendChild(el);
    });
  };

  const resultsAsText = () => {
    const result = lastResult || { rows: [] };
    const lines = [
      "SN Dev Helper - Hidden Portal Variables",
      "Read-only inspector; does not modify the live form.",
      "Rows: " + String((result.rows || []).length),
      "",
    ];
    (result.rows || []).forEach((row) => {
      lines.push(
        (row.label || row.name) +
          " (" + row.name + ") — " +
          (BUCKET_LABELS[row.bucket] || row.bucket) +
          " — " + (row.type || "") +
          " — " + valueCellText(row)
      );
    });
    return lines.join("\n");
  };

  const copyList = async () => {
    const text = resultsAsText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw error;
    }

    if (resultsShadow) {
      const copyButton = resultsShadow.querySelector("[data-action='copy']");
      if (copyButton) {
        const previous = copyButton.textContent;
        copyButton.textContent = "Copied";
        setTimeout(() => {
          if (copyButton) copyButton.textContent = previous;
        }, 1400);
      }
    }
  };

  const bucketCount = (rows, bucket) => rows.filter((row) => row.bucket === bucket).length;

  const showResults = (result) => {
    if (window !== window.top) return;
    closeResults();
    lastResult = result;
    activeFilter = "all";
    searchQuery = "";

    const rows = result.rows || [];

    resultsHost = document.createElement("div");
    resultsHost.id = "snh-hidden-variables-results";
    document.documentElement.appendChild(resultsHost);
    resultsShadow = resultsHost.attachShadow({ mode: "closed" });
    resultsShadow.innerHTML = `
      <style>${UI_CSS}</style>
      <div class="overlay">
        <section class="panel" role="dialog" aria-modal="true" aria-labelledby="snh-hidden-title">
          <header class="header">
            <div class="heading">
              <h2 id="snh-hidden-title">Hidden Variables <span class="best-effort">Best effort</span></h2>
              <div class="subtitle">Variables on this catalog item that are permanently Hidden-type, or currently switched off by a UI Policy/client script.</div>
            </div>
            <button class="close" type="button">Close</button>
          </header>
          <div class="summary">
            <span><strong data-count="total">0</strong>hidden</span>
            <span><strong data-count="hidden-type">0</strong>hidden type</span>
            <span><strong data-count="invisible">0</strong>hidden by policy/script</span>
            <span><strong data-count="absent">0</strong>not rendered</span>
            ${result.foundForm ? "" : '<span class="warning">Could not find the catalog form on this page.</span>'}
          </div>
          <div class="controls">
            <div class="filters" aria-label="Bucket filters">
              <button class="filter active" type="button" data-filter="all">All</button>
              <button class="filter" type="button" data-filter="hidden-type">Hidden type</button>
              <button class="filter" type="button" data-filter="invisible">Hidden by policy/script</button>
              <button class="filter" type="button" data-filter="absent">Not rendered</button>
            </div>
            <input class="search" type="search" placeholder="Search name or label…" aria-label="Search hidden variables" />
          </div>
          <div class="rows"></div>
          <footer class="toolbar">
            <span class="toolbar-note">Read-only inspector — does not modify the live form.</span>
            <button type="button" data-action="close">Close</button>
            <button class="primary" type="button" data-action="copy">Copy list</button>
          </footer>
        </section>
      </div>
    `;

    const setCount = (key, value) => {
      const el = resultsShadow.querySelector("[data-count='" + key + "']");
      if (el) el.textContent = String(value);
    };
    setCount("total", rows.length);
    setCount("hidden-type", bucketCount(rows, "hidden-type"));
    setCount("invisible", bucketCount(rows, "invisible"));
    setCount("absent", bucketCount(rows, "absent"));

    resultsShadow.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "all";
        resultsShadow.querySelectorAll("[data-filter]").forEach((candidate) => {
          candidate.classList.toggle("active", candidate === button);
        });
        renderRows();
      });
    });

    const search = resultsShadow.querySelector(".search");
    if (search) {
      search.addEventListener("input", () => {
        searchQuery = search.value.trim().toLowerCase();
        renderRows();
      });
    }

    const closeButton = resultsShadow.querySelector(".close");
    const footerClose = resultsShadow.querySelector("[data-action='close']");
    const copyButton = resultsShadow.querySelector("[data-action='copy']");
    if (closeButton) closeButton.addEventListener("click", closeResults);
    if (footerClose) footerClose.addEventListener("click", closeResults);
    if (copyButton) copyButton.addEventListener("click", () => copyList().catch(() => {}));

    const overlay = resultsShadow.querySelector(".overlay");
    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeResults();
      });
    }

    resultsKeydownHandler = (event) => {
      if (event.key !== "Escape" || !resultsHost) return;
      event.preventDefault();
      event.stopPropagation();
      closeResults();
    };
    window.addEventListener("keydown", resultsKeydownHandler, true);
    renderRows();
  };

  globalThis.SNHiddenVariablesUI = { showResults };
})();
