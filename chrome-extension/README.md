# 🕹️ Task Solver — Tab Agent (Chrome extension)

This is the "give Claude a whole Chrome tab" version. You pick a tab, tell it what to do,
and Claude reads that tab and **clicks links and types in it** to complete the task —
live, in your own browser.

A normal website can't do this (browsers forbid one page from touching another tab), so
this has to be a Chrome **extension**. It only ever touches the tab you point it at.

## Install (one time, ~2 minutes)

1. Download this `chrome-extension` folder to your computer (keep all the files together)
2. Open Chrome and go to **chrome://extensions**
3. Turn on **Developer mode** (toggle, top-right)
4. Click **Load unpacked** and select the `chrome-extension` folder
5. The "Task Solver — Tab Agent" icon appears in your toolbar (click the puzzle-piece 🧩 to pin it)

## Use it

1. Open the web page you want it to work on in a tab
2. Click the extension icon — a side panel opens
3. First time: paste your Claude API key (from
   [console.anthropic.com](https://console.anthropic.com/settings/keys)) into the 🔑 section
4. Pick the **tab to work on** from the dropdown (click ↻ if you just opened it)
5. Type **what it should do** in that tab, e.g.
   *"Fill this form with the info below and submit"* or *"Search for red running shoes under $50"*
6. Click **▶ Give it the tab** and watch each step appear in the log
7. Hit **◼ Stop** any time to halt it

## How it works

Each step, the extension reads the tab (its text + a numbered list of the links, buttons, and
boxes on the page), sends that to Claude, and Claude picks one action — click #4, type into #7,
press Enter, scroll, or "done". Then it re-reads the page and repeats until the task is finished
or it hits your max-steps limit.

## Safety — please read

- **It performs real actions in that tab.** Clicks and typing actually happen.
- **Never point it at banking, shopping/checkout, or anything you can't undo.** There's a
  max-steps limit and a Stop button, but you are in control — watch what it does.
- It can only touch the one tab you select, and only normal web pages (not `chrome://` pages,
  the Chrome Web Store, or other extensions — Chrome blocks those).
- Your API key is stored in the extension's local storage on your computer and is sent only
  to Anthropic. Every action is charged to your own API credit.
- This is a personal tool for automating your own browser. Don't use it to break the terms of
  service of sites you don't control, to get past CAPTCHAs/anti-bot systems, or on anyone else's
  accounts.
