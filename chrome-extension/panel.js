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

async function runInTab(tabId, func, args) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args: args || [] });
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
  "You are an agent operating a single web browser tab on the user's behalf to accomplish a task. " +
  "Each turn you receive a snapshot: the page URL, visible text, and a numbered list of interactive " +
  "elements (links, buttons, inputs). Choose ONE tool call to make progress. Work in small, verifiable " +
  "steps: read the snapshot, act, then read the new snapshot before acting again. Prefer typing into the " +
  "right field and clicking the right button by its index. When the task is finished, or if you're stuck " +
  "or it would be unsafe to continue, call done with a short summary. Never guess indices that aren't in " +
  "the current snapshot. Do not perform payments or irreversible actions unless the task explicitly says to.";

function snapshotText(s) {
  const els = s.elements.map(e => `[${e.i}] <${e.tag}${e.type ? " " + e.type : ""}> ${e.label}`).join("\n");
  return `URL: ${s.url}\nTITLE: ${s.title}\n\nPAGE TEXT (truncated):\n${s.text}\n\nINTERACTIVE ELEMENTS:\n${els}`;
}

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
    let snap = await runInTab(tabId, pageSnapshot);
    if (!snap) throw new Error("Couldn't read that tab (Chrome blocks internal pages like chrome:// and the Web Store).");

    const messages = [{
      role: "user",
      content: `TASK: ${goal}\n\nHere is the current tab:\n\n${snapshotText(snap)}`
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
        body: JSON.stringify({ model: MODEL, max_tokens: 4000, thinking: { type: "adaptive" }, system: SYSTEM, tools: TOOLS, messages })
      });

      if (!res.ok) {
        let m = "HTTP " + res.status;
        try { const j = await res.json(); if (j.error && j.error.message) m = j.error.message; } catch (_) {}
        if (res.status === 401) m = "Invalid API key — check the 🔑 section.";
        log("API error", m, true); break;
      }

      const data = await res.json();
      messages.push({ role: "assistant", content: data.content });

      const say = data.content.filter(b => b.type === "text").map(b => b.text).join(" ").trim();
      if (say) log("Thinking", say);

      const toolUse = data.content.find(b => b.type === "tool_use");
      if (data.stop_reason !== "tool_use" || !toolUse) {
        log("Done", say || "finished"); break;
      }

      if (toolUse.name === "done") {
        log("✓ Done", toolUse.input.summary || "");
        break;
      }

      // execute the tool in the tab
      let result;
      const inp = toolUse.input || {};
      if (toolUse.name === "click") { log("Click", "element " + inp.index); result = await runInTab(tabId, pageAction, ["click", inp.index, null]); }
      else if (toolUse.name === "type") { log("Type", '"' + (inp.text || "") + '" → ' + inp.index); result = await runInTab(tabId, pageAction, ["type", inp.index, inp.text]); }
      else if (toolUse.name === "press_enter") { log("Enter", ""); result = await runInTab(tabId, pageAction, ["enter", 0, null]); }
      else if (toolUse.name === "scroll") { log("Scroll", inp.direction); result = await runInTab(tabId, pageAction, ["scroll", 0, inp.direction]); }
      else if (toolUse.name === "navigate") { log("Navigate", inp.url); result = await runInTab(tabId, pageAction, ["navigate", 0, inp.url]); }
      else { result = { ok: false, msg: "unknown tool" }; }

      if (result && !result.ok) log("⚠", result.msg, true);

      // let the page settle, then re-snapshot
      await new Promise(r => setTimeout(r, 900));
      snap = await runInTab(tabId, pageSnapshot);
      const outcome = (result && result.msg ? result.msg : "done") +
        (snap ? "\n\nNew tab state:\n\n" + snapshotText(snap) : "\n\n(could not re-read the tab)");

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
