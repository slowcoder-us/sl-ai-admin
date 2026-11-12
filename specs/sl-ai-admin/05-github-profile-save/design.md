# GitHub 用户保存与列表（Web） - 设计

> 对应需求：[requirements.md](./requirements.md)

## 概述

沿用基线提交 21e11b3 中已有的 `github_profile` 表、`add` / `list` 接口和页面（还没有测试）。保存时重新读取 GitHub，并用唯一约束加 `skipDuplicates` 处理重复，并发保存也不会报 500。本 feature 补测试、跳过列表查询的全局 toast，并修正 E2E 清理。

## 技术背景

> 依据：[AGENTS.md](../../../AGENTS.md)、[apps/web/AGENTS.md](../../../apps/web/AGENTS.md)

| 项 | 本 feature 遵循的约定 | 出处 |
|----|----------------------|------|
| 技术栈 | Prisma 7 + PostgreSQL、tRPC v11 | AGENTS.md § 技术栈 |
| 目录与分层 | 业务模型放独立 `.prisma` 文件，`auth.prisma` 不手改 | AGENTS.md § 架构要点 |
| 接口约定 | 需要登录的用 `protectedProcedure`，`ctx.session` 非空 | AGENTS.md § 架构要点 |
| 迁移 | 非 TTY 环境用 `pnpm -F @sl-ai-admin/db exec prisma migrate dev --name <名字>` | AGENTS.md § 经验沉淀 |
| 测试与验证 | Vitest、Playwright；临时账号用 `e2e_` 前缀，由 `global-teardown` 清理 | AGENTS.md § 常用命令、§ 经验沉淀 |

参考的现有实现：

- `packages/api/src/routers/github-profiles.test.ts`（04 新增）：`createCaller` 和 stub `fetch`
- `apps/web/e2e/global-teardown.ts`：E2E 数据清理

## 涉及范围

| 类型 | 路径 / 模块 | 新增 / 修改 | 说明 |
|------|-------------|-------------|------|
| 数据库 | `packages/db/prisma/schema/github-profile.prisma` | 修改 | 模型（已存在，核对） |
| 数据库 | `packages/db/prisma/migrations/20261106120000_github_profiles/migration.sql` | 修改 | 迁移（已存在，核对） |
| 后端 | `packages/api/src/routers/github-profiles.ts` | 修改 | `add`、`list`（已存在，核对） |
| 测试 | `packages/api/src/routers/github-profiles.test.ts` | 修改 | 保存、重复、列表隔离 |
| 前端 | `apps/web/src/app/dashboard/github-users/github-users.tsx` | 修改 | 保存按钮、列表、错误只显示一次 |
| 测试 | `apps/web/e2e/global-teardown.ts` | 修改 | 删除临时账号前先删除其记录 |
| 测试 | `apps/web/e2e/github-users.spec.ts` | 修改 | 保存、重复、隔离 |

## 数据模型

满足 R1、R2、R3、R5。表名 `github_profile`。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String | 主键，`cuid()` | 记录 ID |
| ownerId | String | 必填 | 保存该记录的账号 `user.id` |
| githubId | String | 必填 | GitHub 数字 ID，用于判重，改名后不变 |
| username | String | 必填 | GitHub `login` |
| avatarUrl | String? | | 头像地址 |
| name | String? | | 姓名 |
| bio | String? | | 简介 |
| location | String? | | 所在地 |
| createdAt | DateTime | 默认当前时间 | 保存时间 |

索引：`@@unique([ownerId, githubId])`、`@@index([ownerId, createdAt])`。

`ownerId` 没有外键：`auth.prisma` 由工具生成、不能手改，无法在 `User` 上声明反向关系。项目目前没有删除账号的功能，因此只有 E2E 清理受影响，由 `global-teardown.ts` 显式处理。

## 接口设计

满足 R1、R2、R3、R5。

### `githubProfiles.add`（`protectedProcedure` mutation）

- 请求参数：`string`，`githubUsernameSchema`
- 响应：无
- 处理：`getGithubProfile` → `createMany({ data: { ...profile, ownerId }, skipDuplicates: true })`，`count === 0` 时报重复
- 错误码：`UNAUTHORIZED`；`CONFLICT`「该用户已保存」；GitHub 错误同 `lookup`

### `githubProfiles.list`（`protectedProcedure` query）

- 请求参数：无
- 响应：`GithubProfile[]`
- 处理：`where: { ownerId }`，`orderBy: [{ createdAt: "desc" }, { id: "desc" }]`
- 错误码：`UNAUTHORIZED`

## 界面设计

满足 R1、R3、R4、R6。

### Web · GitHub 用户管理页

- 组件结构：搜索卡片内的「保存用户」按钮、已保存用户卡片（`ul` + `ProfileDetails`）
- 数据更新：`add` 成功后 `invalidateQueries(trpc.githubProfiles.list.queryFilter())`，并清空 `search`
- 跳过全局 toast：`list` 传 `meta: { skipErrorToast: true }`（04 提供）
- 状态：加载 `正在加载…`；空 `还没有保存的用户。`；错误 `role="alert"`；保存中按钮禁用

## 异常与边界情况

| 场景 | 处理方式 |
|------|----------|
| 两个请求并发保存同一用户 | 唯一约束加 `skipDuplicates`，后到的请求返回 CONFLICT |
| 搜索后 GitHub 资料发生变化 | 保存时重新读取，以最新资料为准 |
| 搜索后保存时 GitHub 失败 | 显示 GitHub 错误提示，搜索结果保留 |
| GitHub 用户改名后再保存 | `githubId` 相同，提示「该用户已保存」 |

## 测试策略

- 单元测试：用假的 `ctx.db` 验证 `add` 写入 `ownerId`、`count === 0` 报 CONFLICT；`list` 的 where 和排序；未登录 401。
- E2E：用 `randomUsername()` 注册账号，覆盖保存、刷新后仍在、重复提示、两个账号隔离、空状态。

## 待确认问题

无（数据归属见 requirements.md）
