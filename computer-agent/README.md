# 🤖 Task Solver Agent (runs on YOUR computer)

This is the "use my computer" version of the Task Solver. It's a small program that
runs on your machine, reads assignment files straight off your disk, does the work,
and saves the finished files back — no copy-pasting.

For safety it only works inside its own `workspace/` folder — it can never touch
anything else on your computer.

## Setup (one time, ~5 minutes)

1. **Install Python** from [python.org/downloads](https://www.python.org/downloads/)
   (on Windows, tick "Add Python to PATH" during install)
2. **Install the AI library** — open a terminal/command prompt and run:
   ```
   pip install anthropic
   ```
3. **Get a Claude API key** at [console.anthropic.com](https://console.anthropic.com)
   (Settings → API Keys; add a little credit — a typical assignment costs a few cents)
4. **Save the key on your computer:**
   - **Windows** (Command Prompt): `setx ANTHROPIC_API_KEY "sk-ant-your-key-here"`
     then close and reopen the terminal
   - **Mac/Linux:** add `export ANTHROPIC_API_KEY="sk-ant-your-key-here"` to your
     `~/.zshrc` or `~/.bashrc`

## How to use it

### Batch mode — do every assignment in the inbox

1. Drop your assignment files into `computer-agent/workspace/inbox/`
   (supports `.txt`, `.md`, `.pdf`, photos/screenshots like `.png`/`.jpg`, code files…)
2. Run:
   ```
   python agent.py
   ```
3. Finished work appears in `computer-agent/workspace/done/` — one result file
   per assignment.

### Agent mode — tell it what to do, it handles the files itself

```
python agent.py "Read inbox/notes.txt and turn it into a 10-question practice quiz"
```

In this mode the AI actually operates on your computer's files by itself: it can
**list**, **read**, and **write** files in the workspace while it works, and saves
its finished work into `done/`.

## Safety notes

- The agent is sandboxed to the `workspace/` folder — it cannot read, change, or
  delete anything outside it.
- Your API key stays on your computer as an environment variable and is only sent
  to Anthropic.
- Don't put private stuff (passwords, personal documents you don't want uploaded)
  into the inbox — everything in there gets sent to the AI to be worked on.
