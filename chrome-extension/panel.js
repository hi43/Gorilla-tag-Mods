"use strict";

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";

// ---------- API key ----------
const apiKeyInput = document.getElementById("apiKey");
const keyStatus = document.getElementById("keyStatus");
const setup = document.getElementById("setup");

chrome.storage.local.get("apiKey", (r) => {
  if (r.apiKey) apiKeyInput.value = r.apiKey;
  refreshKeyStatus();
});
apiKeyInput.addEventListener("input", () => {
  chrome.storage.local.set({ apiKey: apiKeyInput.value.trim() });
  refreshKeyStatus();
});
function refreshKeyStatus() {
  const k = apiKeyInput.value.trim();
  if (k) { keyStatus.textContent = "✓ key saved"; keyStatus.className = "hint key-ok"; }
  else { keyStatus.textContent = "⚠ paste an API key above to start"; keyStatus.className = "hint key-bad"; setup.open = true; }
}

// ---------- tab picker ----------
const tabSel = document.getElementById("tabSel");
async function refreshTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabSel.innerHTML = "";
  for (const t of tabs) {
    if (!/^https?:/.test(t.url || "")) continue; // can only script normal web pages
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = (t.title || t.url).slice(0, 60);
    if (active && t.id === active.id) o.selected = true;
    tabSel.appendChild(o);
  }
  if (!tabSel.children.length) {
    const o = document.createElement("option");
    o.textContent = "(open a normal web page in a tab first)";
    o.value = "";
    tabSel.appendChild(o);
  }
}
document.getElementById("refreshTabs").addEventListener("click", refreshTabs);
refreshTabs();

// ---------- logging ----------
const logEl = document.getElementById("log");
function log(action, text, isErr) {
  const d = document.createElement("div");
  d.className = "step" + (isErr ? " err" : "");
  d.innerHTML = '<span class="act">' + esc(action) + "</span>" + (text ? ' <span class="say">' + esc(text) + "</span>" : "");
  logEl.prepend(d);
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ---------- injected into the page: read interactive elements ----------
function pageSnapshot() {
  const SEL = 'a,button,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[onclick],[contenteditable="true"]';
  const nodes = [...document.querySelectorAll(SEL)];
  const out = [];
  let i = 0;
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;          // hidden
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    el.setAttribute("data-tsa", i);
    let label = (el.getAttribute("aria-label") || el.placeholder || el.value ||
                 el.innerText || el.getAttribute("name") || el.getAttribute("title") || "").trim();
    label = label.replace(/\s+/g, " ").slice(0, 120);
    out.push({ i, tag: el.tagName.toLowerCase(), type: el.type || "", label });
    i++;
    if (i >= 200) break;
  }
  const bodyText = (document.body ? document.body.innerText : "").replace(/\s+\n/g, "\n").slice(0, 6000);
  return { url: location.href, title: document.title, text: bodyText, elements: out };
}

// ---------- injected into the page: perform an action ----------
function pageAction(kind, index, value) {
  const find = (n) => document.querySelector('[data-tsa="' + n + '"]');
  try {
    if (kind === "click") {
      const el = find(index); if (!el) return { ok: false, msg: "no element " + index };
      el.scrollIntoView({ block: "center" }); el.click();
      return { ok: true, msg: "clicked " + index };
    }
    if (kind === "type") {
      const el = find(index); if (!el) return { ok: false, msg: "no element " + index };
      el.scrollIntoView({ block: "center" }); el.focus();
      if (el.isContentEditable) { el.textContent = value; }
      else {
        const setter = Object.getOwnPropertyDescriptor(el.__proto__, "value");
        if (setter && setter.set) setter.set.call(el, value); else el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, msg: "typed into " + index };
    }
    if (kind === "enter") {
      const el = document.activeElement || document.body;
      for (const type of ["keydown", "keypress", "keyup"]) {
        el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      }
      if (el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
      return { ok: true, msg: "pressed Enter" };
    }
    if (kind === "scroll") {
      window.scrollBy({ top: (value === "up" ? -1 : 1) * window.innerHeight * 0.85, behavior: "instant" });
      return { ok: true, msg: "scrolled " + value };
    }
    if (kind === "navigate") { location.href = value; return { ok: true, msg: "navigating to " + value }; }
    return { ok: false, msg: "unknown action " + kind };
  } catch (e) {
    return { ok: false, msg: "error: " + (e && e.message ? e.message : e) };
  }
}

// Snapshot EVERY frame (many assignments live inside an embedded iframe),
// then merge into one global index list. globalMap[g] = { frameId, li }.
async function snapshotAllFrames(tabId) {
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: pageSnapshot });
  } catch (_) {
    results = await chrome.scripting.executeScript({ target: { tabId }, func: pageSnapshot });
  }
  const map = [];
  const lines = [];
  const texts = [];
  let main = null, g = 0;
  for (const r of results) {
    if (!r || !r.result) continue;
    if (r.frameId === 0 || main === null) main = r.result;
    if (r.result.text) texts.push(r.result.text);
    for (const el of r.result.elements) {
      map.push({ frameId: r.frameId || 0, li: el.i });
      lines.push(`[${g}] <${el.tag}${el.type ? " " + el.type : ""}> ${el.label}`);
      g++;
    }
  }
  if (!main) return null;
  return {
    map,
    text: `URL: ${main.url}\nTITLE: ${main.title}\n\nPAGE TEXT (truncated):\n` +
          texts.join("\n---\n").slice(0, 7000) +
          `\n\nINTERACTIVE ELEMENTS (${map.length}):\n` + lines.join("\n")
  };
}

async function actInFrame(tabId, frameId, kind, li, value) {
  const target = frameId ? { tabId, frameIds: [frameId] } : { tabId };
  const [res] = await chrome.scripting.executeScript({ target, func: pageAction, args: [kind, li, value] });
  return res ? res.result : null;
}

// ---------- tools given to Claude ----------
const TOOLS = [
  { name: "click", description: "Click the element with the given index from the current snapshot.",
    input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] } },
  { name: "type", description: "Type text into the input/textarea with the given index.",
    input_schema: { type: "object", properties: { index: { type: "integer" }, text: { type: "string" } }, required: ["index", "text"] } },
  { name: "press_enter", description: "Press Enter (submit a form or confirm the focused field).",
    input_schema: { type: "object", properties: {} } },
  { name: "scroll", description: "Scroll the page up or down to reveal more content.",
    input_schema: { type: "object", properties: { direction: { type: "string", enum: ["up", "down"] } }, required: ["direction"] } },
  { name: "navigate", description: "Go to a URL in this tab.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "done", description: "The task is complete (or cannot proceed). Give a short summary.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } }
];

const SYSTEM =
  "You are an agent that OPERATES a web browser tab to actually complete a task — not to describe it. " +
  "Every turn you MUST call exactly one tool that takes an action in the page (click, type, press_enter, " +
  "scroll, navigate) — or call done only when the task is truly finished or genuinely impossible. Never " +
  "reply with a plain explanation instead of acting; do the work directly by clicking and typing. " +
  "Each turn you get a fresh snapshot: the URL, visible text, and a numbered list of interactive elements. " +
  "To answer a question on the page, TYPE the answer into the matching input, or CLICK the correct option/" +
  "radio/checkbox, by its index. Fill fields one by one, then click the submit/next button. If you don't see " +
  "the element you need, scroll to reveal more, and only give up (done) after scrolling hasn't helped. Never " +
  "guess an index that isn't in the current snapshot. Do not make payments or other irreversible actions " +
  "unless the task explicitly asks for it.";

// ---------- the agent loop ----------
let running = false;
let stopRequested = false;
const startBtn = document.getElementById("startBtn");

startBtn.addEventListener("click", async () => {
  if (running) { stopRequested = true; startBtn.textContent = "Stopping…"; return; }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { setup.open = true; apiKeyInput.focus(); return; }
  const tabId = parseInt(tabSel.value, 10);
  if (!tabId) { alert("Pick a tab with a normal web page open."); return; }
  const goal = document.getElementById("goal").value.trim();
  if (!goal) { document.getElementById("goal").focus(); return; }
  const maxSteps = Math.max(1, Math.min(60, parseInt(document.getElementById("maxSteps").value, 10) || 20));

  running = true; stopRequested = false;
  startBtn.textContent = "◼ Stop"; startBtn.classList.add("stop");
  logEl.innerHTML = "";
  log("Goal", goal);

  try {
    let snap = await snapshotAllFrames(tabId);
    if (!snap) throw new Error("Couldn't read that tab (Chrome blocks internal pages like chrome:// and the Web Store).");
    if (!snap.map.length) log("Note", "No clickable/typeable elements found — the page may still be loading, or the task content is protected.", true);

    let lastFrameId = 0;
    const messages = [{
      role: "user",
      content: `TASK: ${goal}\n\nHere is the current tab:\n\n${snap.text}`
    }];

    for (let step = 0; step < maxSteps; step++) {
      if (stopRequested) { log("Stopped", "by you"); break; }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        // tool_choice "any" forces it to ACT every turn instead of just talking.
        body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: SYSTEM, tools: TOOLS, tool_choice: { type: "any" }, messages })
      });

      if (!res.ok) {
        let m = "HTTP " + res.status;
        try { const j = await res.json(); if (j.error && j.error.message) m = j.error.message; } catch (_) {}
        if (res.status === 401) m = "Invalid API key — check the 🔑 section.";
        log("API error", m, true); break;
      }

      const data = await res.json();
      messages.push({ role: "assistant", content: data.content });

      const toolUse = data.content.find(b => b.type === "tool_use");
      if (!toolUse) { log("Done", "no action returned"); break; }

      if (toolUse.name === "done") {
        log("✓ Done", toolUse.input.summary || "");
        break;
      }

      // execute the tool — resolve the global index to its frame + local index
      let result;
      const inp = toolUse.input || {};
      const resolve = (gi) => (gi != null && snap.map[gi]) ? snap.map[gi] : null;

      if (toolUse.name === "click") {
        const t = resolve(inp.index);
        if (!t) { result = { ok: false, msg: "index " + inp.index + " not in snapshot" }; }
        else { lastFrameId = t.frameId; log("Click", "element " + inp.index); result = await actInFrame(tabId, t.frameId, "click", t.li, null); }
      } else if (toolUse.name === "type") {
        const t = resolve(inp.index);
        if (!t) { result = { ok: false, msg: "index " + inp.index + " not in snapshot" }; }
        else { lastFrameId = t.frameId; log("Type", '"' + (inp.text || "") + '" → ' + inp.index); result = await actInFrame(tabId, t.frameId, "type", t.li, inp.text); }
      } else if (toolUse.name === "press_enter") { log("Enter", ""); result = await actInFrame(tabId, lastFrameId, "enter", 0, null); }
      else if (toolUse.name === "scroll") { log("Scroll", inp.direction); result = await actInFrame(tabId, lastFrameId, "scroll", 0, inp.direction); }
      else if (toolUse.name === "navigate") { log("Navigate", inp.url); result = await actInFrame(tabId, 0, "navigate", 0, inp.url); }
      else { result = { ok: false, msg: "unknown tool" }; }

      if (result && !result.ok) log("⚠", result.msg, true);

      // let the page settle, then re-snapshot every frame
      await new Promise(r => setTimeout(r, 900));
      snap = await snapshotAllFrames(tabId);
      if (!snap) snap = { map: [], text: "(could not re-read the tab — it may have navigated away)" };
      const outcome = (result && result.msg ? result.msg : "done") + "\n\nNew tab state:\n\n" + snap.text;

      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: outcome }]
      });

      if (step === maxSteps - 1) log("Stopped", "hit the max-steps safety limit");
    }
  } catch (e) {
    log("Error", e.message || String(e), true);
  } finally {
    running = false;
    startBtn.textContent = "▶ Give it the tab";
    startBtn.classList.remove("stop");
  }
});
