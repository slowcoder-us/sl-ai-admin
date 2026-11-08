# GitHub 用户修改与删除（Web） - 设计

> 对应需求：[requirements.md](./requirements.md)

## 概述

沿用基线提交 21e11b3 中已有的 `update` / `remove` 接口和页面（还没有测试）。接口用 `updateMany` / `deleteMany` 并把 `ownerId` 放进条件，权限和“记录不存在”由同一条语句完成。本 feature 把字段限制移到共享规则，供移动端使用，并补测试。

## 技术背景

> 依据：[AGENTS.md](../../../AGENTS.md)、[apps/web/AGENTS.md](../../../apps/web/AGENTS.md)

| 项 | 本 feature 遵循的约定 | 出处 |
|----|----------------------|------|
| 技术栈 | tRPC v11、Prisma 7、shadcn（base-ui） | AGENTS.md § 技术栈 |
| 共享规则 | 规则只放一处、各端共用 | AGENTS.md § 架构要点 |
| 接口约定 | 需要登录的用 `protectedProcedure` | AGENTS.md § 架构要点 |
| 测试与验证 | Vitest、Playwright、只检查改动文件的 ultracite | AGENTS.md § 常用命令、§ 经验沉淀 |

参考的现有实现：

- `packages/api/src/github-profile-rules.ts`（04 新增）：共享规则
- `apps/web/e2e/github-users.spec.ts`（04、05 新增）：页面用例和临时账号

## 涉及范围

| 类型 | 路径 / 模块 | 新增 / 修改 | 说明 |
|------|-------------|-------------|------|
| 共享规则 | `packages/api/src/github-profile-rules.ts` | 修改 | 增加字段长度常量和 `githubProfileFieldsSchema` |
| 后端 | `packages/api/src/routers/github-profiles.ts` | 修改 | 改用共享规则 |
| 测试 | `packages/api/src/routers/github-profiles.test.ts` | 修改 | 修改、删除、权限 |
| 前端 | `apps/web/src/app/dashboard/github-users/github-users.tsx` | 修改 | `maxLength` 使用共享常量，核对编辑和删除 |
| 测试 | `apps/web/e2e/helpers.ts` | 修改 | 用 `prisma db execute` 直接插入 `github_profile` 记录 |
| 测试 | `apps/web/e2e/github-users.spec.ts` | 修改 | 修改、取消、清空、删除、互斥 |

## 接口设计

满足 R1、R2、R5。

### `githubProfiles.update`（`protectedProcedure` mutation）

- 请求参数：`{ id: string, name: string, bio: string, location: string }`；trim 后 `name`、`location` 最多 255，`bio` 最多 500
- 响应：无
- 处理：空字符串存为 `null`；`updateMany({ data, where: { id, ownerId } })`，`count === 0` 时报 `NOT_FOUND`
- 错误码：`UNAUTHORIZED`；`BAD_REQUEST`（校验失败）；`NOT_FOUND`「找不到该记录」

### `githubProfiles.remove`（`protectedProcedure` mutation）

- 请求参数：`string`（记录 ID）
- 响应：无
- 处理：`deleteMany({ where: { id, ownerId } })`，`count === 0` 时报 `NOT_FOUND`
- 错误码：`UNAUTHORIZED`；`NOT_FOUND`「找不到该记录」

### 共享规则新增内容

```ts
export const GITHUB_PROFILE_LIMITS = { bio: 500, location: 255, name: 255 } as const;
export const githubProfileFieldsSchema = z.object({
	bio: z.string().trim().max(GITHUB_PROFILE_LIMITS.bio),
	location: z.string().trim().max(GITHUB_PROFILE_LIMITS.location),
	name: z.string().trim().max(GITHUB_PROFILE_LIMITS.name),
});
```

## 界面设计

满足 R1、R2、R3、R4、R6。

### Web · 已保存用户列表

- 组件结构：列表项按状态显示 `ProfileDetails` + 操作按钮、`EditProfile` 表单或删除确认
- 状态：`editingId`、`deletingId` 互斥，任一非空时其他记录的「编辑」「删除」禁用
- 数据更新：成功后 `invalidateQueries(trpc.githubProfiles.list.queryFilter())`，并退出编辑或确认状态
- 输入限制：输入框 `maxLength` 来自 `GITHUB_PROFILE_LIMITS`，接口仍做校验
- 错误：`update.error`、`remove.error` 显示在表单或确认处（`role="alert"`）

## 异常与边界情况

| 场景 | 处理方式 |
|------|----------|
| 另一端已删除该记录 | 接口返回 `NOT_FOUND`，就地显示「找不到该记录」 |
| 修改后保存时只含空格 | trim 后为空，存为 `null` |
| 编辑他人记录 ID | `ownerId` 条件不匹配，返回 `NOT_FOUND`，不暴露记录是否存在 |

## 测试策略

- 单元测试：`update` 的空值转换、长度上限、`count === 0`；`remove` 的 `ownerId` 条件、`count === 0`；未登录 401。
- E2E：修改后刷新仍在、取消不保存、清空字段、删除的取消和确认、两种互斥状态。
- E2E 数据准备：服务端直接调用 api.github.com，Playwright 拦不到，匿名限额容易触发限流。因此本 feature 的用例不走搜索和保存，用 `randomUsername()` 注册账号后，通过 `prisma db execute`（与 `global-teardown.ts` 相同的方式）直接插入 `github_profile` 记录。`id` 没有数据库默认值，SQL 里要显式给出；`ownerId` 用用户名查 `user` 表得到。记录由 05 的 `global-teardown.ts` 清理。

## 待确认问题

无
