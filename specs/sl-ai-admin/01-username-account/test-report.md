# 01-username-account 测试记录

## 批次测试 · 批次 1 · 2026-11-02

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <16 个改动文件>` | 通过 | 0 错误（全量 `pnpm check` 有历史遗留错误，不作为闸门） |
| 类型 | `pnpm check-types` | 通过 | 7/7 包 |
| 构建 | `pnpm build` | 通过 | web、server、fumadocs |
| 单元 | `pnpm test` | 通过 | Vitest 30 个用例（`packages/auth/src/credentials.test.ts`） |
| E2E | `pnpm test:e2e` | 通过 | Playwright 10 个用例（`apps/web/e2e/auth.spec.ts`） |
| 迁移 | 空库 `sl_migrate_check` 上 `prisma migrate deploy` | 通过 | `user.username`、`user.displayUsername` 已创建，测完删除临时库 |

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | E2E `sign up › AC1 AC5: registers with a username…`（校验 `get-session` 的 username 小写、displayUsername 原样、占位邮箱） | 通过 | |
| AC2 | E2E `sign up › AC2: the server rejects invalid usernames`、`AC2: the server ignores a client-supplied email` | 通过 | |
| AC3 | E2E `sign in › AC3: email sign-in endpoint is disabled`（404） | 通过 | |
| AC4 | E2E `sign up › AC4: shows field errors…`（断言未发请求）+ Vitest `signUpSchema` | 通过 | |
| AC5 | E2E `sign up › AC1 AC5 …`（跳转 `/dashboard`） | 通过 | |
| AC6 | E2E `sign up › AC6: duplicate username (any case)…` | 通过 | |
| AC7 | E2E `sign in › AC7: signs in with username and password` | 通过 | |
| AC8 | E2E `sign in › AC8: wrong password and unknown user show the same error` | 通过 | |
| AC9 | E2E `sign in › AC9: submit button is disabled…`（拦截请求后断言按钮禁用 + 「登录中…」） | 通过 | |
| AC10 | E2E `AC10: /login shows the sign-in form by default…` | 通过 | |

### 失败与修复

- 无测试失败。开发中遇到的环境问题（Prisma 客户端未生成、turbo 交互任务在非 TTY 下报错）已在 W4a 解决，不计入修复轮次。
