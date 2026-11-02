# 02-web-access-control 测试记录

## 批次测试 · 批次 1 · 2026-11-02

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <10 个改动文件>` | 通过 | 0 错误 |
| 类型 | `pnpm check-types` | 通过 | 7/7 包 |
| 构建 | `pnpm build` | 通过 | 构建输出识别到 `ƒ Proxy (Middleware)` |
| 单元 | `pnpm test` | 通过 | 30 个用例（无新增，本 feature 无纯逻辑模块） |
| E2E | `pnpm test:e2e` | 通过 | 20 个用例（`access-control.spec.ts` 7 个 + 01 的 13 个回归） |

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | E2E `protected pages › AC1: signed-out visitors are sent from /dashboard to /login`；`AC1: an invalid session cookie is still rejected by the page` | 通过 | |
| AC2 | E2E `protected pages › AC2: signed-in users are sent from /login to /dashboard` | 通过 | |
| AC3 | E2E `user menu › AC3: shows the username and signs out back to /login`（含退出后再访问 `/dashboard` 被拦回） | 通过 | |
| AC4 | E2E `user menu › AC4: signed-out header shows a 登录 link to /login` | 通过 | |
| AC5 | E2E `protected pages › AC5: dashboard greets the user by their original username` | 通过 | |
| AC6 | E2E `protected API › AC6: privateData returns 401 without a session and 200 with one`（校验 `error.data.code = UNAUTHORIZED`） | 通过 | |

### 失败与修复

- 开发自检中：`AC4` 首次运行找不到「登录」链接 → 原因：base-ui `Button` 以 `render={<Link/>}` 渲染时强制 `role="button"` → 修改：改用带 `buttonVariants` 样式的 `Link`。修复后批次测试一次通过。
