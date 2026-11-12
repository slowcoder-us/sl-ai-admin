# GitHub 用户修改与删除（Web） - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm test`、`pnpm test:e2e`、`pnpm check-types`、`pnpm exec ultracite check <本 feature 改动的文件>`

- [x] 1. 字段规则共享和接口测试
  - 内容：把字段长度和校验移到共享规则，路由改用；测试覆盖空值转换、长度上限、`ownerId` 条件、记录不存在、未登录
  - 文件：`packages/api/src/github-profile-rules.ts`、`packages/api/src/github-profile-rules.test.ts`、`packages/api/src/routers/github-profiles.ts`、`packages/api/src/routers/github-profiles.test.ts`
  - 需求：R2、R5
  - 完成标准：`pnpm test` 通过；`pnpm check-types` 通过

- [x] 2. 就地编辑表单
  - 内容：`maxLength` 使用共享常量；核对预填、保存后刷新、取消、错误显示和按钮禁用
  - 文件：`apps/web/src/app/dashboard/github-users/github-users.tsx`
  - 需求：R1、R2、R3、R6
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [x] 3. 删除确认和互斥状态
  - 内容：核对二次确认、取消、错误显示；`editingId`、`deletingId` 非空时其他记录的按钮禁用
  - 文件：`apps/web/src/app/dashboard/github-users/github-users.tsx`
  - 需求：R4、R5、R6
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [x] 4. 编写 E2E 测试
  - 内容：用 `prisma db execute` 直接插入测试记录（不走搜索和保存，不消耗 GitHub 匿名限额）；覆盖修改后刷新仍在、取消、清空字段、删除的取消和确认、编辑和确认删除时的按钮互斥
  - 文件：`apps/web/e2e/helpers.ts`、`apps/web/e2e/github-users.spec.ts`
  - 需求：R1、R2、R3、R4、R6
  - 完成标准：`pnpm test:e2e` 通过

- [x] 5. 验收
  - 逐条对照 requirements.md 的 AC1–AC10 检查并勾选
  - 完成标准：所有 AC 通过，待确认问题已关闭或已记录
