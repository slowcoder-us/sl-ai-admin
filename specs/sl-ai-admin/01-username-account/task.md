# 用户名账号（注册 / 登录） - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令（来自 AGENTS.md + W2 确认）：`pnpm exec ultracite check <本 feature 改动的文件>`（全量 `pnpm check` 有 451 个历史遗留错误，不作为闸门）、`pnpm check-types`、`pnpm test`、`pnpm test:e2e`、`pnpm build`

- [ ] 1. 搭建测试基础设施
  - 需求：（支撑全部 R）
  - [ ] 1.1 引入 Vitest
    - 内容：`pnpm-workspace.yaml` catalog 加 `vitest`；`packages/auth` 加 devDependency 和 `"test": "vitest run"`；根 `package.json` 加 `"test": "turbo run test"`；`turbo.json` 加 `test` 任务
    - 文件：`pnpm-workspace.yaml`、`packages/auth/package.json`、`packages/auth/vitest.config.ts`、`package.json`、`turbo.json`
    - 完成标准：`pnpm install` 成功；放一个占位用例后 `pnpm test` 通过
  - [ ] 1.2 引入 Playwright
    - 内容：catalog 加 `@playwright/test`；`apps/web` 加 devDependency 和 `"test:e2e": "playwright test"`；`playwright.config.ts` 用 `webServer` 启动 server（:3000）与 web（:3001），`reuseExistingServer: true`；根 `package.json` 加 `"test:e2e": "pnpm -F web test:e2e"`；`.gitignore` 加 `test-results/`、`playwright-report/`；安装 chromium
    - 文件：`pnpm-workspace.yaml`、`apps/web/package.json`、`apps/web/playwright.config.ts`、`package.json`、`.gitignore`
    - 完成标准：`pnpm exec playwright install chromium` 完成；一个打开 `/` 的冒烟用例 `pnpm test:e2e` 通过

- [ ] 2. 共享校验规则与提示语
  - 内容：实现 `credentials.ts`（常量、`AUTH_MESSAGES`、`signInSchema`、`signUpSchema`、`toPlaceholderEmail`、`getSignUpErrorMessage`、`getSignInErrorMessage`），并写单元测试
  - 文件：`packages/auth/src/credentials.ts`、`packages/auth/src/credentials.test.ts`
  - 需求：R1、R2、R4、R6
  - 完成标准：`pnpm test` 通过，覆盖 design.md「测试策略」列出的边界；改动文件 ultracite 检查零报错

- [ ] 3. 服务端启用 username 插件
  - 内容：`createAuth` 加 `username({...})`、`disabledPaths: ["/sign-in/email"]`、`hooks.before` 覆盖注册的 email / name
  - 文件：`packages/auth/src/index.ts`
  - 需求：R1、R3
  - 完成标准：`pnpm check-types` 通过

- [ ] 4. 数据库 schema 与迁移
  - 内容：`pnpm auth:generate` 重新生成 `auth.prisma`（新增 `username`、`displayUsername`）；`pnpm db:generate`；`pnpm db:migrate --name init_username_auth` 生成首个迁移并应用到本地库
  - 文件：`packages/db/prisma/schema/auth.prisma`（生成）、`packages/db/prisma/migrations/*_init_username_auth/`（生成）
  - 需求：R1
  - 完成标准：本地库 `user` 表有 `username`（唯一）和 `displayUsername` 列；`pnpm check-types` 通过

- [ ] 5. Web 认证客户端
  - 内容：`authClient` 加 `usernameClient()`；`apps/web/package.json` 加 `@sl-ai-admin/auth: workspace:*`
  - 文件：`apps/web/src/lib/auth-client.ts`、`apps/web/package.json`
  - 需求：R5
  - 完成标准：`authClient.signIn.username` 类型可用；`pnpm check-types` 通过

- [ ] 6. Web 登录表单与登录页
  - 内容：登录表单改为用户名 + 密码，使用 `signInSchema`，失败统一提示，加载文案「登录中…」；`/login` 默认显示登录表单；界面中文
  - 文件：`apps/web/src/components/sign-in-form.tsx`、`apps/web/src/app/login/page.tsx`
  - 需求：R5、R6、R7、R8
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 7. Web 注册表单
  - 内容：注册表单改为用户名 + 密码 + 确认密码，使用 `signUpSchema`，调用 `signUp.email` 带占位邮箱，错误码映射中文 toast，加载文案「注册中…」，成功跳 `/dashboard`
  - 文件：`apps/web/src/components/sign-up-form.tsx`
  - 需求：R2、R3、R4、R7
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 8. 端到端测试
  - 内容：编写 `auth.spec.ts`，覆盖 AC1–AC10（AC1 通过注册后 `get-session` 返回的 `user.username` / `displayUsername` 验证）
  - 文件：`apps/web/e2e/auth.spec.ts`
  - 需求：R1–R8
  - 完成标准：`pnpm test:e2e` 全部通过

- [ ] 9. 验收
  - 逐条对照 requirements.md 的验收标准检查并勾选
  - 完成标准：所有 AC 通过；改动文件 ultracite 检查零报错，`pnpm check-types`、`pnpm test`、`pnpm test:e2e`、`pnpm build` 全部通过
