# GitHub 用户管理（移动端） - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm exec ultracite check <本 feature 改动的文件>`、`pnpm -F native check-types`、`pnpm -F native exec expo export --platform ios --output-dir dist`

- [ ] 1. 抽屉入口和页面骨架
  - 内容：增加 `Drawer.Screen` 和页面，放进 `(drawer)` 以获得登录保护
  - 文件：`apps/native/app/(drawer)/_layout.tsx`、`apps/native/app/(drawer)/github-users.tsx`
  - 需求：R1
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 2. 资料展示和错误文案
  - 内容：实现 `ProfileDetails`（头像、资料、用系统浏览器打开主页）和 `trpc-error.ts`
  - 文件：`apps/native/components/github-users/profile-details.tsx`、`apps/native/lib/trpc-error.ts`
  - 需求：R2、R3、R8
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 3. 搜索和保存
  - 内容：用共享规则校验用户名，查询并显示结果和错误；保存后清空搜索结果并刷新列表
  - 文件：`apps/native/components/github-users/search-card.tsx`、`apps/native/app/(drawer)/github-users.tsx`
  - 需求：R2、R4、R8
  - 完成标准：`pnpm -F native check-types` 通过；`expo export --platform ios` 成功（验证 Metro 能解析 `@sl-ai-admin/api/github-profile-rules`）

- [ ] 4. 已保存列表
  - 内容：列表、倒序、加载、空状态和错误显示
  - 文件：`apps/native/components/github-users/saved-profiles.tsx`、`apps/native/app/(drawer)/github-users.tsx`
  - 需求：R5、R8
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 5. 就地修改
  - 内容：编辑表单预填内容、长度限制、清空、保存和取消
  - 文件：`apps/native/components/github-users/edit-profile-form.tsx`、`apps/native/components/github-users/saved-profiles.tsx`
  - 需求：R6、R8
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 6. 删除确认和互斥状态
  - 内容：二次确认、取消、错误显示；`editingId`、`deletingId` 非空时其他记录的按钮禁用
  - 文件：`apps/native/components/github-users/saved-profiles.tsx`
  - 需求：R7、R8
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 7. 打包检查和手动验收清单
  - 内容：运行打包检查；按 03 的格式写 AC1–AC14 的 Android 模拟器验收步骤
  - 文件：`specs/sl-ai-admin/08-native-github-profiles/manual-checklist.md`
  - 需求：R1–R8
  - 完成标准：`pnpm -F native check-types` 和 `pnpm -F native exec expo export --platform ios --output-dir dist` 通过；清单覆盖 AC1–AC14

- [ ] 8. 验收
  - 逐条对照 requirements.md 的 AC1–AC15，用 adb 在 Android 模拟器上检查并勾选；iOS 未验证，记入遗留问题
  - 完成标准：所有 AC 通过，结果记入 `manual-checklist.md`，待确认问题已关闭或已记录
