# Copilot instructions (agent guidance)

- Use the `copilot_loop` `ask_user` tool whenever you intend to end your turn and hand control back to the user. Do not finish or pause without calling it.
- Use the `copilot_loop` `ask_user` tool whenever you have a question that needs the user's answer.
- Only one elicitation can be active per server; if you get timeouts or "already in progress" errors, retry or inform the user.
