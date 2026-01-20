# Copilot instructions (agent guidance)

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

### Why this matters:

The `ask_user` tool enables a proper conversational loop. Without it, the user cannot respond to you properly. Every turn MUST end with a tool call.

### Technical notes:

- Only one elicitation can be active per server; if you get timeouts or "already in progress" errors, retry or inform the user.
- For long questions (> 120 chars), put the full question in the property `title` field (not the tool `message`).
