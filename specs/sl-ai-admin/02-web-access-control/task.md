# Web 访问控制与退出登录 - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm exec ultracite check <本 feature 改动的文件>`、`pnpm check-types`、`pnpm test:e2e`、`pnpm build`
> 写代码前先读 `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` 和 `01-app/02-guides/authentication.md`（apps/web/AGENTS.md 要求）。

- [ ] 1. 服务端会话工具与显示名
  - 内容：新增 `getServerSession()`、`getDisplayName(user)`
  - 文件：`apps/web/src/lib/get-server-session.ts`、`apps/web/src/lib/display-name.ts`
  - 需求：R1、R2、R3、R4
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 2. 后台页服务端拦截与欢迎语
  - 内容：`dashboard/page.tsx` 改用 `getServerSession`，未登录 `redirect("/login")`，显示「欢迎，<用户名>」；`dashboard.tsx` 文案中文化
  - 文件：`apps/web/src/app/dashboard/page.tsx`、`apps/web/src/app/dashboard/dashboard.tsx`
  - 需求：R1、R4
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 3. 登录页改为服务端判断
  - 内容：原 `login/page.tsx` 的表单切换逻辑移到 `auth-forms.tsx`（客户端，默认登录）；`page.tsx` 改为服务端组件，已登录 `redirect("/dashboard")`
  - 文件：`apps/web/src/app/login/page.tsx`、`apps/web/src/app/login/auth-forms.tsx`
  - 需求：R2
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 4. Proxy 乐观跳转
  - 内容：新增 `proxy.ts`，`/dashboard/:path*` 无会话 cookie 时重定向 `/login`
  - 文件：`apps/web/src/proxy.ts`
  - 需求：R1
  - 完成标准：`pnpm build` 通过且构建输出识别到 Proxy；改动文件 ultracite 检查零报错

- [ ] 5. 用户菜单与退出登录
  - 内容：菜单显示用户名、去掉邮箱、「退出登录」后清缓存并跳 `/login`；未登录显示「登录」；`header.tsx` 导航文案中文化
  - 文件：`apps/web/src/components/user-menu.tsx`、`apps/web/src/components/header.tsx`
  - 需求：R3
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 6. 端到端测试
  - 内容：抽出注册辅助函数到 `helpers.ts`；编写 `access-control.spec.ts` 覆盖 AC1–AC6
  - 文件：`apps/web/e2e/helpers.ts`、`apps/web/e2e/access-control.spec.ts`、`apps/web/e2e/auth.spec.ts`（改为引用 helpers）
  - 需求：R1–R5
  - 完成标准：`pnpm test:e2e` 全部通过（含 01 的用例）

- [ ] 7. 验收
  - 逐条对照 requirements.md 的验收标准检查并勾选
  - 完成标准：所有 AC 通过；改动文件 ultracite 检查零报错，`pnpm check-types`、`pnpm test`、`pnpm test:e2e`、`pnpm build` 全部通过
