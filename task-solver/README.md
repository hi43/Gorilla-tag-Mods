# ⚡ Task Solver AI

A single-file web app that completes tasks and assignments for you using the Claude API.
Paste one task or a whole list — writing, planning, summarizing, researching, problem-solving —
and it works through them all.

## Features

- **⚡ Do the task** — completes the task fully and delivers the finished result
- **🗺️ Make a plan** — breaks a big task into clear, ordered steps with tips
- **✨ Improve my work** — paste your draft/attempt, it polishes it and explains the changes
- **Batch mode** — add as many tasks as you want and hit "Do them all" once
- Streams answers live as they're generated
- No install, no server — just open the file in a browser

## Setup (2 minutes)

1. Get a Claude API key:
   - Go to [console.anthropic.com](https://console.anthropic.com) and sign up
   - Add a small amount of credit (usage is pay-per-use; a typical task costs a few cents)
   - Create a key under **Settings → API Keys**
2. Open `index.html` in any browser (double-click it, or drag it into Chrome/Edge/Firefox)
3. Click **🔑 Setup**, paste your key — it's saved in your browser and only ever sent to Anthropic

That's it. Paste a task and hit **Do them all**.

## Notes

- Your API key is stored in your browser's localStorage on your own computer. Don't share
  the key or use this app on a shared/public computer.
- Uses the `claude-opus-4-8` model via the Anthropic Messages API directly from the browser.
