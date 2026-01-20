# copilot_loop

Minimal MCP server exposing one tool: `ask_user`.

Purpose: let an agent ask the human for structured input via MCP elicitation **form mode** (Copilot UI renders the form).

## What it does

- Implements MCP tool `ask_user`.
- Tool call triggers `elicitation/create` (mode `"form"`) using the provided `message` + `requestedSchema`.
- Returns a JSON tool result envelope (`status`, `action`, `content`, `error`).
- While waiting for user input, sends periodic `notifications/progress` (when a `progressToken` is present) to reduce Copilot tool-call timeouts.
- Handles tool-call cancellation and clears in-flight state (so the next tool call works).
- Uses a long server->client elicitation request timeout (default 24h) so the user can take >60s to answer without the server timing out.

## Requirements

- Node.js >= 18
- npm

## Install / build

```sh
npm install
npm run build
```

## Run (stdio)

```sh
node dist/index.js
```

Debug logs:

```sh
ASK_USER_DEBUG=1 node dist/index.js
```

Timeout/keepalive knobs:

```sh
# Progress notification frequency (default: 5000)
ASK_USER_PROGRESS_INTERVAL_MS=5000

# Server->client elicitation request timeout (default: 86400000 = 24h)
ASK_USER_ELICITATION_TIMEOUT_MS=86400000
```

## Global Copilot Instructions (recommended)

Add the following to your project's `.github/copilot-instructions.md` (or global config):

```markdown
## MANDATORY: Use the `copilot_loop` `ask_user` tool

**You MUST call the `copilot_loop` `ask_user` tool before every turn ends. No exceptions.**

### Rules (MUST follow):

1. **ALWAYS end your turn by calling `ask_user`** — Never finish, pause, or yield control without calling this tool first.
2. **Call the tool IMMEDIATELY after completing any work** — Do not announce you will use it "next turn" or "later". Call it NOW, in THIS response.
3. **Questions require the tool** — If you ask the user a question, you MUST call `ask_user` in the same response. Do not ask questions in chat text alone.
4. **Confirmations require the tool** — After completing a task, call `ask_user` to confirm with the user (e.g., "Does this look good?" or "What's next?").

### Anti-patterns (NEVER do these):

❌ Ending your response without calling `ask_user`
❌ Saying "I'll use the tool in my next response"
❌ Asking a question in text without also calling `ask_user`
❌ Announcing you are done without calling `ask_user` to confirm
```

This explicit guidance helps ensure models (especially those less inclined to use tools) actually call the `ask_user` tool every turn.

## JetBrains Copilot MCP config (stdio)

Use the IDE’s MCP server configuration UI and point it at the compiled entrypoint.

Example (conceptual):

- Command: `node`
- Args: `/absolute/path/to/copilot_loop/dist/index.js`
- Env (optional): `ASK_USER_DEBUG=1`

See `examples/mcp.json` for a copy/paste starting point.

