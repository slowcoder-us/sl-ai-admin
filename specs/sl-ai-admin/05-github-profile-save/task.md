# GitHub 用户保存与列表（Web） - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm test`、`pnpm test:e2e`、`pnpm check-types`、`pnpm exec ultracite check <本 feature 改动的文件>`

- [x] 1. 核对数据模型和迁移
  - 内容：确认模型、唯一约束、索引与迁移一致；生成 Prisma Client 并应用迁移
  - 文件：`packages/db/prisma/schema/github-profile.prisma`、`packages/db/prisma/migrations/20261106120000_github_profiles/migration.sql`
  - 需求：R1、R2、R3、R5
  - 完成标准：`pnpm db:generate` 成功；`pnpm -F @sl-ai-admin/db exec prisma migrate status` 显示迁移已应用

- [x] 2. 保存和列表接口测试
  - 内容：覆盖写入 `ownerId` 和 GitHub 最新资料、重复时 CONFLICT、GitHub 错误透传、列表只查当前账号且倒序、未登录 401
  - 文件：`packages/api/src/routers/github-profiles.test.ts`、`packages/api/src/routers/github-profiles.ts`
  - 需求：R1、R2、R3、R5
  - 完成标准：`pnpm test` 通过

- [x] 3. 保存按钮和已保存列表界面
  - 内容：核对保存后的缓存刷新和清空搜索、加载和空状态、按钮禁用；`list` 使用 `meta.skipErrorToast`
  - 文件：`apps/web/src/app/dashboard/github-users/github-users.tsx`
  - 需求：R1、R3、R4、R6
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [x] 4. E2E 清理和用例
  - 内容：`global-teardown.ts` 在删除临时账号前，先删除这些账号的 `github_profile` 记录；E2E 覆盖保存、刷新后仍在、重复提示、账号隔离、空状态
  - 文件：`apps/web/e2e/global-teardown.ts`、`apps/web/e2e/github-users.spec.ts`
  - 需求：R1、R2、R3、R4、R5、R6
  - 完成标准：`pnpm test:e2e` 通过；跑完后 `github_profile` 中没有 `e2e_` 账号的记录

- [x] 5. 验收
  - 逐条对照 requirements.md 的 AC1–AC9 检查并勾选
  - 完成标准：所有 AC 通过，待确认问题已关闭或已记录
