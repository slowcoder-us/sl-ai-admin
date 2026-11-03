# cp01-01-username-account 评审结论

评审者：Codex（/codex:review，codex-cli 0.166.0） · 范围：sl/sl-ai-admin-reviewed...d097b96 · 日期：2026-11-02
原始输出：[cp01-01-username-account-codex.md](./cp01-01-username-account-codex.md)
统计：共 3 条，采纳 3，不采纳 0，需你决定 0（另有 1 条 Claude 复核时自查发现，一并修复）

| 序号 | 级别 | 位置 | 问题摘要 | 结论 | 理由 | 修复 |
|------|------|------|----------|------|------|------|
| 1 | P2 | packages/auth/src/index.ts:20-22 | 注册请求不带 username 时 hook 直接放行，创建了带任意邮箱、无用户名、无法再登录的账号 | 采纳 | 已复现：回退修复后 E2E `AC1: the server rejects sign-up without a username` 返回 200 | hook 对缺失 / 非字符串 username 抛 `BAD_REQUEST`（code `INVALID_USERNAME`） |
| 2 | P2 | packages/auth/src/index.ts:61-65 | 插件默认允许 `/update-user` 改用户名，改名后占位邮箱和 name 不同步，旧用户名无法再注册 | 采纳 | 已复现：回退修复后 `AC1: identity fields cannot be changed after sign-up` 改名返回 200；PRD 无改名功能 | `username({ immutableUsername: true })`，且 hook 拒绝 `/update-user` 修改身份字段 |
| 3 | P2 | packages/auth/src/index.ts:28 | 注册时客户端可自带 `displayUsername`，与用户名不一致 | 采纳 | 已复现：回退修复后 `AC1: displayUsername always comes from the username` 存入了 `SomeoneElse` | hook 用校验后的用户名覆盖 `displayUsername` |
| 4 | — | packages/auth/src/index.ts | （自查）`immutableUsername` 不限制 `/update-user` 改 `displayUsername` / `name`，登录用户可把显示名改成任意值 | 采纳 | 读插件源码确认 immutable 只校验 `username` | hook 对 `/update-user` 请求体含 `username` / `displayUsername` / `name` / `email` 任一字段时抛 `BAD_REQUEST`（code `IDENTITY_IS_IMMUTABLE`） |

按用户要求，本提交点只评审一轮，修复后不再送 Codex。
