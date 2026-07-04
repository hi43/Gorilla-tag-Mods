#!/usr/bin/env python3
"""Task Solver Agent — an AI that uses YOUR computer to do assignments.

It works inside one folder (its "workspace") so it can never touch the
rest of your computer:

    computer-agent/
      workspace/
        inbox/   <- drop assignment files here (txt, md, pdf, png, jpg, docx-as-pdf...)
        done/    <- finished work appears here

Two ways to use it:

  1. Batch mode — do every assignment in the inbox:
        python agent.py

  2. Agent mode — give it a task; it can list, read, and write files
     in the workspace all by itself while working:
        python agent.py "Read notes.txt in my inbox and turn it into a study guide"

Setup: pip install anthropic   then set the ANTHROPIC_API_KEY environment
variable (see README.md).
"""

import base64
import sys
from pathlib import Path

try:
    import anthropic
    from anthropic import beta_tool
except ImportError:
    sys.exit("The 'anthropic' package is missing. Run:  pip install anthropic")

MODEL = "claude-opus-4-8"

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE / "workspace"
INBOX = WORKSPACE / "inbox"
DONE = WORKSPACE / "done"

IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".gif": "image/gif", ".webp": "image/webp"}
TEXT_TYPES = {".txt", ".md", ".csv", ".json", ".py", ".js", ".html", ".css",
              ".java", ".c", ".cpp", ".cs", ".log"}

SYSTEM = (
    "You are a capable assistant completing tasks and assignments for the user. "
    "Deliver finished, ready-to-use work: if it's a writing task, write the full text; "
    "if it's a problem set, solve every problem and show the work; if it's a question, "
    "answer it thoroughly. If something is ambiguous, make a sensible assumption, state "
    "it in one line, and keep going. Format math as plain text (use / and ^, no LaTeX)."
)

AGENT_SYSTEM = SYSTEM + (
    " You have tools to list, read, and write files inside the user's workspace folder. "
    "Use them: read any files the task mentions, and SAVE your finished work to the "
    "'done' folder with write_file (pick a sensible filename ending in .md). "
    "When you're finished, summarize what you did and name the files you created."
)


def safe_path(relative: str) -> Path:
    """Resolve a path inside the workspace; refuse anything that escapes it."""
    p = (WORKSPACE / relative).resolve()
    if not p.is_relative_to(WORKSPACE):
        raise ValueError(f"Path '{relative}' is outside the workspace — not allowed.")
    return p


# ---------- tools the agent can use (all scoped to the workspace) ----------

@beta_tool
def list_files() -> str:
    """List every file currently in the workspace (inbox and done folders)."""
    files = [str(p.relative_to(WORKSPACE)) for p in WORKSPACE.rglob("*") if p.is_file()]
    return "\n".join(files) if files else "(workspace is empty)"


@beta_tool
def read_file(path: str) -> str:
    """Read a text file from the workspace.

    Args:
        path: Path relative to the workspace, e.g. "inbox/notes.txt".
    """
    p = safe_path(path)
    if not p.is_file():
        return f"Error: no file at '{path}'. Use list_files to see what exists."
    if p.suffix.lower() in IMAGE_TYPES or p.suffix.lower() == ".pdf":
        return (f"Error: '{path}' is a binary file (image/PDF). "
                "Ask the user to run batch mode for those, or work from its filename.")
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return f"Error reading '{path}': {e}"


@beta_tool
def write_file(path: str, content: str) -> str:
    """Save a file into the workspace (finished work belongs in the done folder).

    Args:
        path: Path relative to the workspace, e.g. "done/essay-final.md".
        content: The full text content to write.
    """
    p = safe_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"Saved {len(content)} characters to '{path}'."


# ---------- batch mode: do everything in the inbox ----------

def file_as_content(p: Path):
    """Turn an inbox file into API content blocks."""
    suffix = p.suffix.lower()
    if suffix in IMAGE_TYPES:
        data = base64.standard_b64encode(p.read_bytes()).decode()
        return [{"type": "image",
                 "source": {"type": "base64", "media_type": IMAGE_TYPES[suffix], "data": data}}]
    if suffix == ".pdf":
        data = base64.standard_b64encode(p.read_bytes()).decode()
        return [{"type": "document",
                 "source": {"type": "base64", "media_type": "application/pdf", "data": data},
                 "title": p.name}]
    if suffix in TEXT_TYPES:
        return [{"type": "text",
                 "text": f'Assignment file "{p.name}":\n```\n'
                         + p.read_text(encoding="utf-8", errors="replace") + "\n```"}]
    return None


def batch_mode(client: anthropic.Anthropic) -> None:
    files = sorted(p for p in INBOX.iterdir() if p.is_file())
    todo = [(p, file_as_content(p)) for p in files]
    skipped = [p.name for p, c in todo if c is None]
    todo = [(p, c) for p, c in todo if c is not None]

    if skipped:
        print("Skipping unsupported file types:", ", ".join(skipped))
    if not todo:
        print(f"Nothing to do — drop assignment files into:\n  {INBOX}")
        return

    print(f"Found {len(todo)} assignment(s) in the inbox.\n")
    for i, (p, content) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] Working on {p.name} ...")
        content = content + [{"type": "text",
                              "text": "Complete this assignment fully and deliver the finished work."}]
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=SYSTEM,
                messages=[{"role": "user", "content": content}],
            ) as stream:
                result = stream.get_final_message()
        except anthropic.AuthenticationError:
            sys.exit("Invalid API key — check your ANTHROPIC_API_KEY (see README.md).")
        except anthropic.APIError as e:
            print(f"  !! API error on {p.name}: {e.message}")
            continue

        text = "".join(b.text for b in result.content if b.type == "text")
        out = DONE / (p.stem + "-result.md")
        out.write_text(text, encoding="utf-8")
        print(f"  -> saved {out.relative_to(HERE)}")

    print("\nAll done! Finished work is in:", DONE)


# ---------- agent mode: it works the files itself ----------

def agent_mode(client: anthropic.Anthropic, task: str) -> None:
    print(f"Task: {task}\nThe agent is working (it may read/write workspace files)...\n")
    runner = client.beta.messages.tool_runner(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=AGENT_SYSTEM,
        tools=[list_files, read_file, write_file],
        messages=[{"role": "user", "content": task}],
    )
    try:
        # Iterate so the user can watch the agent work in real time
        for message in runner:
            for block in message.content:
                if block.type == "tool_use":
                    target = ""
                    if isinstance(block.input, dict) and "path" in block.input:
                        target = " " + str(block.input["path"])
                    print(f"  [agent] {block.name}{target}")
                elif block.type == "text" and block.text.strip():
                    print(block.text)
    except anthropic.AuthenticationError:
        sys.exit("Invalid API key — check your ANTHROPIC_API_KEY (see README.md).")
    except anthropic.APIError as e:
        sys.exit(f"API error: {e.message}")

    print("\nCheck the done folder for any files it saved:", DONE)


def main() -> None:
    INBOX.mkdir(parents=True, exist_ok=True)
    DONE.mkdir(parents=True, exist_ok=True)

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

    if len(sys.argv) > 1:
        agent_mode(client, " ".join(sys.argv[1:]))
    else:
        batch_mode(client)


if __name__ == "__main__":
    main()
