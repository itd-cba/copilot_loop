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

Add the following to your global `copilot-instructions.md`:

- Use the `copilot_loop` `ask_user` tool whenever you intend to end your turn and hand control back to the user. Do not finish or pause without calling it.
- Use the `copilot_loop` `ask_user` tool whenever you have a question that needs the user's answer.
- Only one elicitation can be active per server; if you get timeouts or "already in progress" errors, retry or inform the user.

## JetBrains Copilot MCP config (stdio)

Use the IDE’s MCP server configuration UI and point it at the compiled entrypoint.

Example (conceptual):

- Command: `node`
- Args: `/absolute/path/to/copilot_loop/dist/index.js`
- Env (optional): `ASK_USER_DEBUG=1`

See `examples/mcp.json` for a copy/paste starting point.

## Tool: `ask_user`

### Input

- `message` (string, required): shown above the form.
- `requestedSchema` (object, required): restricted JSON Schema describing form fields:
  - top-level `{ type: "object", properties: { ... }, required?: [...] }`
  - flat fields only (no nested objects)
  - supported field types:
    - `{ type: "string" }` (+ `minLength`, `maxLength`, `pattern`, `format`, `default`)
    - `{ type: "number" }` / `{ type: "integer" }` (+ `minimum`, `maximum`, `default`)
    - `{ type: "boolean" }` (+ `default`)
    - single-select enum:
      - `{ type: "string", enum: ["a","b"] }` OR
      - `{ type: "string", oneOf: [{const:"a",title:"A"}, ...] }`
    - multi-select enum:
      - `{ type: "array", items: { type: "string", enum: [...] } }` OR
      - `{ type: "array", items: { anyOf: [{const:"a",title:"A"}, ...] } }`

### “Select OR freeform” pattern

Represent this as _two_ fields:

- `<key>`: enum including `"Other"`
- `<key>_details`: optional string

Agent interpretation:

- if `<key> === "Other"` then use `<key>_details` (and re-ask if empty)
- else use `<key>`

### Output (returned as JSON text)

Envelope:

- `status: "ok" | "error"`
- `action: "accept" | "decline" | "cancel" | null`
- `content: object | null` (present only for `accept`)
- `error?: { code, message }`

Error codes:

- `ELICITATION_UNSUPPORTED`
- `INVALID_REQUESTED_SCHEMA`
- `ELICITATION_IN_PROGRESS`
- `ELICITATION_FAILED`
