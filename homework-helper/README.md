# 📚 Homework Helper AI

A single-file web app that helps you work through homework problems using the Claude API.
It's built as a **study aid** — it explains, gives hints, and checks your work so you actually
learn the material (not just copy answers).

## Features

- **Explain step-by-step** — solves the problem and explains the *why* behind every step
- **Hints only** — progressive hints so you can crack it yourself; never reveals the answer
- **Check my answer** — paste the problem + your work, it finds and explains mistakes
- **Batch mode** — add as many problems as you want and hit "Solve all" once
- Streams answers live as they're generated
- No install, no server — just open the file in a browser

## Setup (2 minutes)

1. Get a Claude API key:
   - Go to [console.anthropic.com](https://console.anthropic.com) and sign up
   - Add a small amount of credit (usage is pay-per-use; a typical problem costs a few cents)
   - Create a key under **Settings → API Keys**
2. Open `index.html` in any browser (double-click it, or drag it into Chrome/Edge/Firefox)
3. Click **🔑 Setup**, paste your key — it's saved in your browser and only ever sent to Anthropic

That's it. Paste a problem and hit **Solve all**.

## Notes

- Your API key is stored in your browser's localStorage on your own computer. Don't share
  the key or use this app on a shared/public computer.
- Uses the `claude-opus-4-8` model via the Anthropic Messages API directly from the browser.
- A friendly reminder: check your school's rules on AI assistance, and use the **Hints** and
  **Check my answer** modes when you want to genuinely practice.
