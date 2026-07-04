# ⚡ Task Solver AI

A single-file web app that completes tasks and assignments for you using the Claude API.
Paste one task or a whole list — writing, planning, summarizing, researching, problem-solving —
and it works through them all.

## Features

- **⚡ Do the task** — completes the task fully and delivers the finished result
- **🗺️ Make a plan** — breaks a big task into clear, ordered steps with tips
- **✨ Improve my work** — paste your draft/attempt, it polishes it and explains the changes
- **📎 Attach files from your computer** — PDFs, photos/screenshots, and text/code files are
  sent along with the task so the AI can read the actual assignment material (up to 20 MB each)
- **⬇ Save results to your computer** — download any finished result as a file
- **📋 Copy button** — one click to copy a result to your clipboard
- **Autosave** — your task list and mode are remembered even if you close the browser
- **Batch mode** — add as many tasks as you want and hit "Do them all" once
- Streams answers live as they're generated
- No install, no server — just open the file in a browser

> Note: a web page can't directly control your computer (browsers block that for safety),
> so instead you attach the files a task needs and download the finished work back.

## Setup (2 minutes)

1. Get a Claude API key:
   - Go to [console.anthropic.com](https://console.anthropic.com) and sign up
   - Add a small amount of credit (usage is pay-per-use; a typical task costs a few cents)
   - Create a key under **Settings → API Keys**
2. Open `index.html` in any browser (double-click it, or drag it into Chrome/Edge/Firefox)
3. Click **🔑 Setup**, paste your key — it's saved in your browser and only ever sent to Anthropic

That's it. Paste a task and hit **Do them all**.

## 📱 Using it on your phone

Phones can't easily open a downloaded `.html` file, so put the app online with GitHub Pages
(free, ~1 minute):

1. Merge this into `main` (there's already a copy of the app at `docs/index.html`)
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder: `/docs` → Save**
3. After a minute your app is live at `https://hi43.github.io/Gorilla-tag-Mods/` —
   open that on your phone and even add it to your home screen like a real app

On mobile you also get a **📷 Take a photo** button — snap a picture of a worksheet
and it becomes the attachment. There's a **◼ Stop** button too (the solve button turns
into it while working).

## Notes

- Your API key is stored in your browser's localStorage on your own computer. Don't share
  the key or use this app on a shared/public computer.
- Uses the `claude-opus-4-8` model via the Anthropic Messages API directly from the browser.
