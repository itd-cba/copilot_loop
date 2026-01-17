# MCP “ask_user” Elicitation Tool — Implementation Plan

## Summary
- Goals
  - Minimal MCP server exposing tool `ask_user`.
  - Tool call -> `elicitation/create` (form mode; per MCP spec 2025-11-25) -> wait -> return structured answer.
  - Support multiple questions in one tool call via a single form schema with multiple properties.
  - Support elicitation form mode types in spec:
    - restricted JSON Schema subset (strings, numbers/integers, booleans, enums incl multi-select arrays).
  - Default transport: STDIO (one process per IDE instance).
  - Distribution “like MCP servers repo”:
    - TypeScript sources in `src/`, compiled JS in `dist/`.
    - Package `bin` points at `dist/index.js` so `npx` runs the compiled entrypoint.
    - Entrypoint includes `#!/usr/bin/env node` shebang (useful on POSIX; harmless on Windows).
    - Cross-platform build: if we set executable bits, do it conditionally (POSIX-only), not as a hard requirement.
  - Windows colleague support:
    - `npm run build` + `node dist/index.js` works on Windows/macOS/Linux.
- Non-goals
  - IntelliJ/JetBrains plugin UI.
  - Server-side “agent logic” (no deciding *what* to ask).
  - URL mode elicitation (explicitly not supported).
  - Shared HTTP transport unless explicitly requested later.
- Assumptions
  - JetBrains Copilot MCP client declares `elicitation` capability and supports `form` mode.
  - Node.js runtime available on developer machines (assume Node >= 18).
  - Copilot can use structured tool outputs (or JSON-in-text fallback).
  - Use latest TypeScript at implementation time (as of 2026-01-17: `typescript@5.9.3`).

## Acceptance Criteria
- Tool `ask_user` appears in Copilot Agent Mode tool list and is callable.
- If the connected MCP client does **not** support elicitation:
  - Preferred: do not register/advertise `ask_user` at all (avoid confusing the agent).
  - Fallback (if SDK/client flow prevents hiding tools): register tool but return a clear structured error.
- Tool definition teaches usage:
  - `tools/list` shows a clear `description` for `ask_user`.
  - `inputSchema` includes `description` for key fields (`message`, `requestedSchema`, `questions`, question `kind`, enum+freeform pattern).
- When Copilot calls `ask_user` in **form mode**:
  - Copilot UI shows message text.
  - UI renders a multi-field form when `requestedSchema.properties` contains multiple properties.
  - Form fields render for all supported schema types per spec:
    - string (incl `format`: `email|uri|date|date-time`)
    - number/integer
    - boolean
    - enum single-select (`enum` or `oneOf` w/ `{const,title}`)
    - enum multi-select (array + `items.enum` or `items.anyOf` w/ `{const,title}`)
- On user submit:
  - Tool returns `{status, action, content?, raw}` with content matching `requestedSchema` (form mode).
  - Copilot can continue with the returned structured answer (no extra chat turn).
- On user cancel/decline, or client disconnect mid-elicitation:
  - Tool returns a structured cancellation result (no crash/hang).
- Multi-instance (STDIO):
  - Two JetBrains IDE instances can run independently (separate server processes).
  - Server exits cleanly when IDE closes (stdin closes).
- Formatting:
  - `npm run format:check` passes (Prettier).
- Windows:
  - On Windows, `npm install`, `npm run build`, `npm test` all pass; no POSIX-only steps required.

## Scope / Approach
- Runtime: Node.js, TypeScript, STDIO MCP server process (launched by JetBrains per IDE instance).
- Use official TypeScript SDK `@modelcontextprotocol/sdk` to reduce protocol risk.
- Logging: off by default; enable minimal debug logs via env flag (e.g., `ASK_USER_DEBUG=1`).
- Tool ergonomics: rely on tool + field `description` strings as the “documentation” the LLM actually sees (via `tools/list`).
- Capability gating:
  - During MCP `initialize`, inspect client capabilities.
  - If elicitation is unsupported, do not advertise `ask_user` (preferred).
- Concurrency policy (single IDE instance):
  - Allow only 1 in-flight elicitation at a time per server process; reject concurrent calls with structured error `{code:"ELICITATION_IN_PROGRESS"}`.
- Data flow
  1) Copilot calls tool `ask_user` with pass-through elicitation request params (`mode`, `message`, `requestedSchema`).
  2) Server validates:
     - for form mode: schema adheres to spec restrictions (flat object, primitive properties only, enum array rules)
     - no other elicitation in flight
  3) Server sends `elicitation/create`; awaits response.
  4) Server normalizes response into `{status, action, content?, raw}` and returns it.

## Files To Change
- `package.json`
  - `bin` -> `dist/index.js` (npx-friendly).
  - `files` includes `dist/` (and docs/examples as desired).
  - Scripts:
    - `build` (tsc + postbuild step)
    - `start` (node dist)
    - `test`
    - `format` / `format:check`
    - `prepack`/`prepare` as needed.
- `tsconfig.json`
  - TS compile to `dist/` (NodeNext / ES2022).
- `scripts/postbuild.mjs` (or similar)
  - POSIX-only: set executable bit on `dist/*.js` (best-effort); no-op on Windows.
- `.prettierrc.json` (or `prettier.config.cjs`)
  - Minimal repo-wide formatting config.
- `.prettierignore`
  - Ignore `dist/`, `node_modules/`, and other generated files.
- `src/index.ts`
  - MCP server entrypoint; tool registration; STDIO lifecycle.
- `src/ask_user.ts`
  - Tool arg validation; response normalization; error mapping.
- `src/elicitation_schema.ts`
  - Spec-accurate schema types + validators (restricted subset).
- `test/ask_user.test.ts`
  - Unit tests for schema builder + normalization (node built-in test runner).
- `README.md`
  - JetBrains Copilot MCP setup; copy/paste config; usage examples; troubleshooting.
- (Optional) `examples/mcp.json`
  - Sample config blob for colleagues to paste.

## Data Structures & Interfaces

### Tool metadata (LLM-facing documentation)
- `ask_user` tool `description` should include, at minimum:
  - What it does: creates an elicitation form and returns the user-provided content.
  - Multi-question guidance: include multiple properties in `requestedSchema` to render one multi-field UI.
  - Enum + freeform pattern (important):
    - If caller wants “select OR freeform”, encode it as *two properties* in the form:
      - `<key>`: enum including `"Other"`
      - `<key>_details`: optional string
    - Interpretation guidance for the agent:
      - if `<key> === "Other"` then read `<key>_details` (and re-ask if empty)
      - else use `<key>` value
  - Cancellation guidance:
    - Handle `action:"cancel"` / `action:"decline"` by stopping work or asking again with a simpler question set.
- Mirror critical usage notes in `inputSchema` field-level `description` so the model sees them next to the fields.

### Tool input (`ask_user`) — v1 (pass-through only; “dumb server”)
- `mode?: "form"` (default `"form"`)
- `message: string` (required)
- `requestedSchema: RequestedSchema` (required; restricted JSON Schema subset per spec)

### Phase 2 (Optional): Shorthand multi-question builder
- If needed (agent struggles to author valid `requestedSchema`), add an optional `questions[]` mode that deterministically compiles into one `requestedSchema`.
- Keep it minimal (only primitives + enum + enum multi-select) and treat it as pure convenience; core contract remains pass-through.

### MCP tool inputSchema (JSON Schema)
- Define `ask_user` tool `inputSchema` for v1 (single branch):
  - requires `message` + `requestedSchema`
- In-handler validation still required (client/schema quirks; guardrails; size limits).
- Add `description` strings:
  - On `requestedSchema` and enum+freeform pattern (encode as `<key>` + `<key>_details`).

### Elicitation request
- Method: `elicitation/create`
- Params:
  - `mode?: "form"` (omit allowed)
  - `message: string`
  - `requestedSchema: object` (restricted JSON schema)

### Restricted schema generation rules
- Enforce MCP 2025-11-25 form schema restrictions:
  - Top-level: `{ type: "object", properties: Record<string, PrimitiveSchema>, required?: string[] }`
  - Flat only (no nested objects; no arrays except enum multi-select arrays).
  - PrimitiveSchema supported:
    - string: `minLength`, `maxLength`, `pattern`, `format`, `default`, `title`, `description`
    - number/integer: `minimum`, `maximum`, `default`, `title`, `description`
    - boolean: `default`, `title`, `description`
    - enum single-select:
      - string + `enum: string[]` OR string + `oneOf: {const,title}[]`
    - enum multi-select:
      - array + `items.enum: string[]` OR `items.anyOf: {const,title}[]`, plus `minItems`, `maxItems`, `default`
- Suggested guardrails (server-side; fail-fast with structured error):
  - Max properties: ~50
  - Max `message` length: ~8000
  - Max enum options per field: ~100
  - Max per-string `maxLength`: cap at ~10000
- Shorthand mapping pattern (recommended):
  - Each question becomes a schema property keyed by `key` (required, stable, machine-friendly).
  - For “choice + details” UX: represent as two properties:
    - `${key}`: enum/string field
    - `${key}_details`: optional string field
  - If `"Other"` semantics needed: server may add `"Other"` only when it also includes `${key}_details`.

### Tool output (returned to Copilot)
- Always return JSON with:
  - `status: "ok" | "error"`
  - `action: "accept" | "decline" | "cancel" | null`
  - `content: object | null` (accept only; matches `requestedSchema`)
  - `raw: object | null` (full response object for debugging)
  - `error?: { code: string, message: string }`
- Encoding:
  - Prefer SDK-native structured return if supported by the client/SDK.
  - Otherwise: return a single `text` content item containing JSON stringified output.
#### Error codes (explicit; stable for agent prompts)
- `ELICITATION_UNSUPPORTED`
  - Message: client does not support form elicitation; tool unavailable.
- `INVALID_REQUESTED_SCHEMA`
  - Message: `requestedSchema` violates elicitation form restrictions; include first failing reason (e.g., “nested object not allowed”).
- `ELICITATION_IN_PROGRESS`
  - Message: another elicitation is already pending; caller must wait.
- `ELICITATION_FAILED`
  - Message: elicitation request failed unexpectedly (transport/client error); retry may succeed.

## Key Decisions

### Approach A: Node.js + official MCP SDK + STDIO (JavaScript, no build step)
- Pros: minimal setup; fewer moving parts; fastest rollout; easiest “copy/paste” config; low protocol risk via SDK.
- Cons: less type safety vs TypeScript.
- Risks: SDK API mismatch with JetBrains client; mitigate via small surface area + manual validation in IDE.
- Verification story: unit tests for schema builder + normalization; manual IDE elicitation smoke test.
- Rollout story: colleagues run `npm install`; JetBrains config points at `node src/index.js`.

### Approach B: Node.js + official MCP SDK + STDIO (TypeScript + build)
- Pros: stronger type safety; clearer contracts as code grows.
- Cons: adds build step + `tsconfig`; more onboarding friction.
- Risks: build artifacts/paths mismatch in JetBrains config; mitigate via `npm run build` + pinned entrypoint.
- Verification story: `npm run build` + tests against `dist/`.
- Rollout story: ship compiled `dist/` or require local build.

### Approach C: Hand-rolled MCP JSON-RPC over STDIO
- Pros: zero SDK dependency.
- Cons: highest protocol risk; more code; harder to keep up with MCP changes; more bug surface for concurrency/session edges.
- Risks: subtle protocol incompatibilities; mitigations limited without re-implementing SDK behavior.
- Verification story: larger integration harness needed.
- Rollout story: simple runtime, but more brittle.

**Chosen**: Approach B (TypeScript + official SDK + STDIO).
- Rationale (priority order): correctness/safety + maintainability/testability improved via typed schema validator; compatibility/rollout acceptable with single `npm run build` step.

## Testing Strategy (Testing Trophy)
- Static
  - `npm run build` (tsc compile, noEmitOnError).
  - `npm run format:check` (prettier verify, no writes).
- Unit (`node --test`)
  - `validateRequestedSchema()` accepts all schema types in spec; rejects unsupported features (nested objects, arrays of objects, etc).
  - Normalization of elicitation responses (`accept`, `cancel`, `decline`).
  - Input validation (reject missing `message`/`requestedSchema`, invalid question specs).
  - Concurrency policy:
    - second `ask_user` invocation while first is pending -> `{status:"error", error.code:"ELICITATION_IN_PROGRESS"}`
  - Capability gating:
    - given client capabilities without elicitation -> `ask_user` not advertised (or advertised but clearly errors, per chosen fallback)
  - Tool spec correctness:
    - `ask_user` tool has non-empty `description`.
    - Key `inputSchema` nodes have `description` populated (to “teach” the LLM patterns).
- Integration (lightweight, no JetBrains dependency)
  - Mock “elicitation client” function to simulate `elicitation/create` round-trip.
  - Ensure tool handler returns expected JSON tool output for accept/cancel/decline.
- Manual (required)
  - JetBrains Copilot Agent Mode:
    - Form mode: multi-field schema renders; defaults pre-populate if client supports.

## Step-by-Step Plan

1) Project skeleton + minimal deps
   - Changes:
     - Add `package.json` (TypeScript build, `bin` pointing to `dist/index.js`, `start`, `build`, `test` scripts).
       - Dev deps include:
         - `typescript@5.9.3` (current latest as of 2026-01-17; re-verify via `npm view typescript version`)
         - `prettier@3.8.0` (current latest as of 2026-01-17; re-verify via `npm view prettier version`)
     - Add `tsconfig.json`.
     - Add `scripts/postbuild.mjs`:
       - If platform is POSIX: `chmod` dist entrypoints best-effort.
       - If Windows: no-op.
     - Add `.prettierrc.json` (or `prettier.config.cjs`) + `.prettierignore`.
      - Add `src/` + `test/` directories.
   - Verification:
      - `node -v` shows >= 18.
      - `npm install` succeeds.
      - `npm run build` succeeds.
      - `npm run format:check` passes.
      - `node dist/index.js` starts (then exits cleanly on stdin close).
      - Windows smoke check (documented): `npm run build` does not fail due to `chmod`.

2) Implement spec-accurate schema types + validation
   - Changes:
     - `src/elicitation_schema.ts`: `RequestedSchema`/`PrimitiveSchema` types; `validateRequestedSchema()`.
   - Verification:
     - `npm test` covers accept/reject cases for each supported primitive schema type; all green.

3) Implement response normalization + error mapping (form only)
   - Changes:
     - `src/ask_user.ts`: `normalizeElicitationResult()` mapping:
       - accept -> `{status:"ok", action:"accept", content?, raw}`
       - decline/cancel -> `{status:"ok", action:"decline"|"cancel", content:null, raw}`
     - `src/ask_user.ts`: map key failure cases to explicit error codes:
       - unsupported -> `ELICITATION_UNSUPPORTED`
       - invalid schema -> `INVALID_REQUESTED_SCHEMA`
       - in-flight -> `ELICITATION_IN_PROGRESS`
   - Verification:
     - `npm test` covers each action; expected output matches contract.
     - `npm test` covers each error code with expected message prefix.

4) Implement MCP tool schema + descriptions (LLM-facing)
   - Changes:
     - `src/ask_user.ts` (or `src/tool_schema.ts`):
       - Centralize `ask_user` tool `description`.
       - Centralize `inputSchema` with per-field `description` text.
       - Document enum+freeform pattern explicitly.
   - Verification:
     - `npm test` asserts descriptions present (non-empty) in tool + key schema fields.

5) Implement MCP server STDIO entrypoint (TS)
   - Changes:
      - `src/index.ts`:
        - Start MCP server over STDIO.
        - Capability-gate tool registration:
          - if client capabilities include elicitation -> register/advertise `ask_user`
          - else -> do not register `ask_user` (preferred)
        - Tool handler supports pass-through `elicitation/create` params (form)
        - Enforce single in-flight elicitation per process; reject concurrent calls with `ELICITATION_IN_PROGRESS`.
        - Enforce schema restrictions before sending (fail fast with structured error).
        - No global “current session”; rely on SDK request context.
        - Minimal debug logging behind env flag (do not spam by default).
        - Exit cleanly on stdin close / SIGINT.
      - Ensure entrypoint has `#!/usr/bin/env node` shebang at top (preserved through TS->JS emit).
   - Verification:
      - `npm run build` then `node dist/index.js` starts without throwing; exits on stdin close (manual: Ctrl-D).
      - `npm test` still green.
      - Optional packaging smoke test: `npm pack` then `npx -y ./<tgz>` starts (ensures `bin` + shebang + dist publish ok).
      - Capability-gating smoke test (best-effort):
        - With a mocked initialize params lacking elicitation, `tools/list` does not include `ask_user` (or, if fallback chosen, tool exists but returns structured error).

6) README + JetBrains config example
   - Changes:
      - `README.md`: install/run steps; JetBrains MCP config snippet; troubleshooting.
      - (Optional) `examples/mcp.json`: copy/paste example pointing at local repo path.
      - Include both:
        - Local dev config: `node /abs/path/to/repo/dist/index.js`
        - Published config (later): `npx -y <package>@<version>`
   - Verification:
      - Manual: follow README in a fresh clone; reach “server starts” state reliably.

7) Manual end-to-end in JetBrains Copilot
   - Changes:
     - None (validation step).
   - Verification (expected outcomes):
     - Form mode: Copilot calls `ask_user` with multi-property schema -> single multi-field UI appears.
     - Submitting returns tool result containing JSON with `status:"ok", action:"accept", content:{...}`.
     - Decline/cancel returns `status:"ok", action:"decline"|"cancel"` and Copilot continues gracefully.

8) Handle tool-call cancellation + send progress notifications
   - Changes:
     - `src/server.ts`: pass tool request `extra.signal` down to `server.elicitInput(...)` so Copilot cancellation unwinds and clears in-flight state.
     - `src/server.ts`: while waiting for user input, emit `notifications/progress` (if `progressToken` present) every ~5s to extend Copilot tool timeout.
     - `test/cancellation_inflight.test.js`: regression test (cancel first call; second call succeeds; progress observed).
   - Verification:
     - `npm run format:check` passes.
     - `npm test` passes.
     - Manual: in JetBrains Copilot, let tool call sit > 60s and confirm it does not get force-cancelled; if cancelled, next call still works (no stuck in-flight).

## Risks & Rollout
- Risk: JetBrains client partial/changed elicitation support vs MCP 2025-11-25
  - Mitigation: capability-gate tool registration; keep schemas within spec restrictions; document observed client behavior.
- Risk: Copilot not parsing JSON from tool result
  - Mitigation: return both human-readable summary + JSON (or JSON-only) depending on what Copilot handles best; document recommended prompt pattern for agent (“treat tool output as JSON”).
- Risk: Concurrency (multiple in-flight elicitations)
  - Mitigation: explicit single-in-flight policy; reject concurrent calls deterministically; add tests.
- Risk: Windows friction (POSIX assumptions)
  - Mitigation: no required `chmod`; postbuild is no-op on Windows; document `node dist/index.js` as the universal entry.
- Rollout
  - Phase 1: STDIO only; internal colleagues.
  - Phase 2 (optional, explicitly requested): shared HTTP transport + session scoping + idle shutdown.

## Open Questions
- Confirm best-return format for Copilot (structured vs JSON-in-text) once tested in IDE.

## Phase 2 (Optional) Steps
- Add shorthand multi-question builder (`questions[]`)
  - Changes:
    - Extend tool `inputSchema` with `oneOf` branch for `questions[]`.
    - Implement `buildRequestedSchemaFromQuestions(questions[])` producing one combined schema (single UI).
  - Verification:
    - `npm test` covers multi-question build (required list, defaults, enum titles via oneOf/anyOf).

## Implementation Progress
- [x] Step 1: Project skeleton + minimal deps
- [x] Step 2: Spec-accurate schema validation
- [x] Step 3: Normalize + error mapping
- [x] Step 4: Tool schema + descriptions
- [x] Step 5: STDIO server entrypoint
- [x] Step 6: README + examples
- [x] Step 7: Manual JetBrains validation (validated by user)
- [x] Step 8: Cancellation + progress notifications
- [ ] Phase 2 (Optional): `questions[]` shorthand

## Implementation Decisions
- Use SDK peer deps explicitly (`zod`, `@cfworker/json-schema`)
  - Why: `@modelcontextprotocol/sdk` declares them as peer deps; install should be deterministic.
  - Alternatives: rely on transitive deps (rejected: brittle).
- Pin toolchain versions to satisfy `npm config before` constraint
  - Why: npm in this environment enforces `before = 2026-01-13`; newer versions fail install.
  - Alternatives: remove `before` constraint (rejected: out of scope).
- Shebang handling via `scripts/postbuild.mjs`
  - Why: TypeScript version used here doesn’t support `preserveShebang`; postbuild injects shebang best-effort and keeps Windows safe.
  - Alternatives: require TS >= 5.9 and use `preserveShebang` (blocked by npm `before` constraint).
- Ignore `copilot_loop_plan.md` in Prettier
  - Why: keep formatting enforcement on code while avoiding reformat churn on the plan text.
  - Alternatives: format plan markdown (deferred).
- Run tests against compiled `dist/` output
  - Why: keep tooling minimal (no ts-node/tsx); ensures published JS matches tests.
  - Alternatives: compile tests too / run TS tests directly (rejected: adds config or runtime tooling).
- Normalize elicitation responses to a stable tool result envelope
  - Why: keep agent-side prompting stable (`status`, `action`, `content`, `error.code`).
  - Alternatives: return raw MCP response only (rejected: agent ergonomics worse).
- Centralize LLM-facing docs as exported constants
  - Why: stable tests (no reliance on Zod internals) and consistent tool/field descriptions.
  - Alternatives: introspect Zod schema metadata in tests (rejected: brittle).
- Capability gating on `server.oninitialized`
  - Why: client capabilities are reliably available after initialization; avoids races that can disable tools incorrectly.
  - Alternatives: gate immediately after `connect()` (rejected: racy with in-memory tests).
- Progress notifications while waiting for user input
  - Why: Copilot cancels tool calls after ~60s; progress notifications keep the tool call alive.
  - Alternatives: increase client timeout (not controllable by server).
- Plumb tool call cancellation via `extra.signal`
  - Why: unblock in-flight state when client cancels/timeout triggers.
  - Alternatives: server-side watchdog timeout (rejected: less accurate; races).
- Increase server->client elicitation request timeout
  - Why: default MCP request timeout is 60s; user input regularly exceeds; avoid server-side timeout that can leave the client UI “stuck” and reject subsequent elicitations.
  - Alternatives: rely on progress notifications (not applicable to server->client request timeout).
