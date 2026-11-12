# cp04-04-github-profile-search 评审结论

评审者：Codex（/codex:review，codex-cli 0.166.0） · 范围：sl/sl-ai-admin-reviewed...8534452 · 日期：2026-11-07
原始输出：[cp04-04-github-profile-search-codex.md](./cp04-04-github-profile-search-codex.md)
统计：共 2 条，采纳 0，不采纳 2，需你决定 0

| 序号 | 级别 | 位置 | 问题摘要 | 结论 | 理由 | 修复 |
|------|------|------|----------|------|------|------|
| 1 | P2 | apps/web/src/lib/get-server-session.ts:17-18 | 校验会话时只转发 cookie，丢失客户端 IP，生产环境下 `/get-session` 共用一个限流桶，超限后已登录用户被跳到登录页 | 不采纳（超出 04 范围，记入遗留问题） | 机制属实：better-auth 1.7.12 取不到 IP 时用 `no-trusted-ip` 按路径共用一个桶（`dist/api/rate-limiter/index.mjs` 的 `resolveRateLimitConfig`）；生产环境默认开启，10 秒 100 次（`dist/context/create-context.mjs:170-175`）；`packages/auth/src/index.ts` 没有配置 `ipAddress`；helper 捕获失败后返回 null。但这段改动来自基线提交 21e11b3，用途是接 `AWS_API_ORIGIN`，属于暂缓的 07 部署范围，04 的 AC 不涉及。只改这一处也解决不了：未提交的 `apps/web/src/lib/proxy-aws-api.ts` 同样只转发 4 个头，登录请求也会共用桶，还要决定信任哪个 IP 头。本轮指示不改部署相关文件、不扩大范围。线上影响未实测 | — |
| 2 | P2 | apps/web/src/app/dashboard/github-users/github-users.tsx:144-144 | `githubProfiles.list` 失败时列表区提示一次，全局 toast 又提示一次 | 不采纳（属于 05，不在 04 修） | 问题属实：第 144 行没有传 `meta: { skipErrorToast: true }`，`apps/web/src/utils/trpc.ts` 的 `QueryCache.onError` 会弹 toast，第 249 行又显示一次。但 04 的 AC8 只管 `lookup`；这个修复已排进 `05-github-profile-save` 的任务 3，由 05 的 AC9 验收，在 05 开发时完成 | — |
