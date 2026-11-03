# 移动端用户名登录注册 - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm exec ultracite check <本 feature 改动的文件>`、`pnpm -F native check-types`、`pnpm -F native exec expo export --platform ios --output-dir dist`

- [x] 1. 认证客户端与共享规则接入
  - 内容：`apps/native/package.json` 加 `@sl-ai-admin/auth: workspace:*` 并 `pnpm install`；`authClient` 加 `usernameClient()`；新增 `getDisplayName`
  - 文件：`apps/native/package.json`、`apps/native/lib/auth-client.ts`、`apps/native/lib/display-name.ts`
  - 需求：R2、R4、R6
  - 完成标准：`pnpm -F native check-types` 通过；`expo export --platform ios` 打包成功（验证 Metro 能解析 `@sl-ai-admin/auth/credentials`）

- [x] 2. 登录表单
  - 内容：改为用户名 + 密码，使用 `signInSchema`，统一错误提示，加载状态，中文；接收 `onSwitchToSignUp`
  - 文件：`apps/native/components/sign-in.tsx`
  - 需求：R4、R7
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [x] 3. 注册表单
  - 内容：用户名 + 密码 + 确认密码，使用 `signUpSchema`，`signUp.email` 带占位邮箱，错误码映射，加载状态，中文；接收 `onSwitchToSignIn`
  - 文件：`apps/native/components/sign-up.tsx`
  - 需求：R2、R3、R7
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [x] 4. 登录 / 注册页与路由保护
  - 内容：新增 `app/sign-in.tsx`（默认登录，可切换）；根布局用 `useSession` + `Stack.Protected` 分组，加载中显示 Spinner
  - 文件：`apps/native/app/sign-in.tsx`、`apps/native/app/_layout.tsx`
  - 需求：R1、R5
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [x] 5. 首页与退出登录
  - 内容：新增 `UserMenu`（用户名 + 退出登录），挂到抽屉 `headerRight`；首页去掉登录注册卡片和邮箱，显示「欢迎，<用户名>」
  - 文件：`apps/native/components/user-menu.tsx`、`apps/native/app/(drawer)/_layout.tsx`、`apps/native/app/(drawer)/index.tsx`
  - 需求：R6
  - 完成标准：`pnpm -F native check-types` 通过；改动文件 ultracite 检查零报错

- [x] 6. 打包检查与手动验收清单
  - 内容：运行 `expo export --platform ios` 确认整包可构建；在交付报告用的清单中写出 AC1–AC8 的模拟器手动步骤
  - 文件：`specs/sl-ai-admin/03-native-username-auth/manual-checklist.md`
  - 需求：R1–R7
  - 完成标准：打包成功；清单覆盖 AC1–AC8

- [x] 7. 验收
  - 逐条对照 requirements.md 的验收标准检查并勾选（AC9 自动验证；AC1–AC8 由用户按清单在模拟器手动验收，结果记入交付报告）
  - 完成标准：AC9 通过；改动文件 ultracite 检查零报错，`pnpm check-types`、`pnpm test` 通过
