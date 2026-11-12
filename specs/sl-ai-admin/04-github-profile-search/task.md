# GitHub 用户搜索（Web） - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm test`、`pnpm test:e2e`、`pnpm check-types`、`pnpm exec ultracite check <本 feature 改动的文件>`

- [x] 1. 给 `packages/api` 加单元测试环境
  - 内容：增加 `test` 脚本、`vitest`（`catalog:`）和 `vitest.config.ts`，配置参照 `packages/auth`
  - 文件：`packages/api/package.json`、`packages/api/vitest.config.ts`、`pnpm-lock.yaml`
  - 需求：R3、R5
  - 完成标准：`pnpm test` 能运行到 `packages/api`

- [x] 2. 抽出共享用户名规则
  - 内容：新增 `githubUsernameSchema` 和提示语常量，路由改用共享规则，并补规则测试
  - 文件：`packages/api/src/github-profile-rules.ts`、`packages/api/src/github-profile-rules.test.ts`、`packages/api/src/routers/github-profiles.ts`
  - 需求：R3
  - 完成标准：`pnpm test` 通过，覆盖合法用户名、开头 / 结尾 / 连续连字符、40 位、非法字符

- [x] 3. 查询接口的鉴权和错误映射测试
  - 内容：stub `fetch`，用 `createCaller` 覆盖成功、404、403、429、500、超时、非法内容、头像来源、未登录；核对 `appRouter` 已挂载
  - 文件：`packages/api/src/routers/github-profiles.test.ts`、`packages/api/src/routers/github-profiles.ts`、`packages/api/src/routers/index.ts`
  - 需求：R2、R4、R5
  - 完成标准：`pnpm test` 通过；`pnpm check-types` 通过

- [x] 4. 核对后台入口和页面访问控制
  - 内容：确认首页入口使用 `Link` + `buttonVariants`，页面调用 `getServerSession()`
  - 文件：`apps/web/src/app/dashboard/page.tsx`、`apps/web/src/app/dashboard/github-users/page.tsx`
  - 需求：R1、R2
  - 完成标准：与 design.md 一致；改动文件 ultracite 检查零报错

- [x] 5. 搜索表单校验和错误显示
  - 内容：提交前用共享规则校验；格式错误显示中文提示且不发请求；`QueryCache.onError` 支持 `meta.skipErrorToast`，`lookup` 使用该选项；核对加载和禁用状态、资料显示和新标签页链接
  - 文件：`apps/web/src/app/dashboard/github-users/github-users.tsx`、`apps/web/src/utils/trpc.ts`
  - 需求：R3、R4、R5、R6
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [x] 6. 编写 E2E 测试
  - 内容：覆盖未登录跳转、首页入口、格式错误只提示一次且没有 JSON、搜索 `octocat` 显示资料和主页链接；临时账号用 `randomUsername()`，断言超时 15 秒
  - 文件：`apps/web/e2e/github-users.spec.ts`
  - 需求：R1、R2、R3、R4、R5
  - 完成标准：`pnpm test:e2e` 通过（需要本地 PostgreSQL 和外网）

- [x] 7. 验收
  - 逐条对照 requirements.md 的 AC1–AC9 检查并勾选
  - 完成标准：所有 AC 通过，待确认问题已关闭或已记录
