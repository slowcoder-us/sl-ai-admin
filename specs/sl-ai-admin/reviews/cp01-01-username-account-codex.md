[codex] Starting Codex review thread.
[codex] Thread ready (01a19d02-70d6-7382-b3e7-d6fed3164582).
[codex] Reviewer started: changes against 'sl/sl-ai-admin-reviewed'
[codex] Running command: /bin/zsh -lc "git status --short; git diff --stat a9c3ad2f3d8a8429a7a911cc21c54111717c280f; f...
[codex] Command completed: /bin/zsh -lc "git status --short; git diff --stat a9c3ad2f3d8a8429a7a911cc21c54111717c280f; f... (exit 0)
[codex] Running command: /bin/zsh -lc 'cat AGENTS.md; cat apps/web/AGENTS.md; cat .agents/skills/ultracite/SKILL.md; c...
[codex] Command completed: /bin/zsh -lc 'cat AGENTS.md; cat apps/web/AGENTS.md; cat .agents/skills/ultracite/SKILL.md; c... (exit 0)
[codex] Running command: /bin/zsh -lc 'cat .agents/skills/better-auth-best-practices/SKILL.md; cat .agents/skills/verc...
[codex] Command completed: /bin/zsh -lc 'cat .agents/skills/better-auth-best-practices/SKILL.md; cat .agents/skills/verc... (exit 0)
[codex] Running command: /bin/zsh -lc 'cat apps/web/e2e/auth.spec.ts apps/web/e2e/helpers.ts packages/auth/src/credent...
[codex] Command completed: /bin/zsh -lc 'cat apps/web/e2e/auth.spec.ts apps/web/e2e/helpers.ts packages/auth/src/credent... (exit 0)
[codex] Running command: /bin/zsh -lc 'cat specs/sl-ai-admin/README.md; cat specs/sl-ai-admin/01-username-account/desi...
[codex] Command completed: /bin/zsh -lc 'cat specs/sl-ai-admin/README.md; cat specs/sl-ai-admin/01-username-account/desi... (exit 0)
[codex] Running command: /bin/zsh -lc 'cat packages/auth/node_modules/better-auth/dist/plugins/username/client.mjs; ca...
[codex] Command completed: /bin/zsh -lc 'cat packages/auth/node_modules/better-auth/dist/plugins/username/client.mjs; ca... (exit 0)
[codex] Running command: /bin/zsh -lc "TSX_DISABLE_CACHE=1 node --import ./apps/server/node_modules/tsx/dist/loader.mj...
[codex] Command completed: /bin/zsh -lc "TSX_DISABLE_CACHE=1 node --import ./apps/server/node_modules/tsx/dist/loader.mj... (exit 0)
[codex] Running command: /bin/zsh -lc 'for f in /AGENTS.override.md /AGENTS.md /Users/AGENTS.override.md /Users/AGENTS...
[codex] Command completed: /bin/zsh -lc 'for f in /AGENTS.override.md /AGENTS.md /Users/AGENTS.override.md /Users/AGENTS... (exit 0)
[codex] Running command: /bin/zsh -lc 'git diff a9c3ad2f3d8a8429a7a911cc21c54111717c280f'
[codex] Command completed: /bin/zsh -lc 'git diff a9c3ad2f3d8a8429a7a911cc21c54111717c280f' (exit 0)
[codex] Review output captured.
[codex] Reviewer finished.
[codex] Assistant message captured: The server does not fully enforce the new username-only identity model. Handler-level reprodu...
[codex] Turn completed.
# Codex Review

Target: branch diff against sl/sl-ai-admin-reviewed

The server does not fully enforce the new username-only identity model. Handler-level reproductions confirmed username-less registrations, inconsistent identity after renaming, and caller-controlled display usernames.

Full review comments:

- [P2] Reject registrations that omit the username — /Users/slowcoder/Desktop/sl-ai-admin/packages/auth/src/index.ts:20-22
  A direct `/sign-up/email` request containing only `{name, email, password}` skips this hook. Because the username plugin makes its fields optional, this returns 200, creates an authenticated session, and stores the caller-supplied email without a username. The account then cannot sign back in because email login is disabled. Reject missing/non-string usernames on registration rather than returning early, preserving the username-only invariant in [AGENTS.md:73](AGENTS.md#L73).

- [P2] Keep username changes synchronized with derived identity — /Users/slowcoder/Desktop/sl-ai-admin/packages/auth/src/index.ts:61-65
  The plugin permits authenticated `/update-user` requests to change usernames by default. After registering `Alice` and changing the username to `Bob`, the account retains `alice@users.sl-ai-admin.local` and name `Alice`; registering the now-unused `Alice` fails with `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. Either enable `immutableUsername` or synchronize the derived identity transactionally when renaming, consistent with [AGENTS.md:73](AGENTS.md#L73).

- [P2] Derive displayUsername from the supplied username — /Users/slowcoder/Desktop/sl-ai-admin/packages/auth/src/index.ts:28-28
  A registration request can supply `username: "Alice"` alongside `displayUsername: "SomeoneElse"`. Spreading the request body preserves that override, and the plugin accepts and stores it instead of using the username's original spelling. This violates the display identity invariant in [AGENTS.md:73](AGENTS.md#L73) and returns contradictory username fields in sessions. Overwrite `displayUsername` from the validated username alongside email and name.
