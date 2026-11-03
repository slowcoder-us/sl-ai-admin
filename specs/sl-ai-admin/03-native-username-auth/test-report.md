# 移动端用户名登录注册 - 测试记录

> 需求：[requirements.md](./requirements.md) · 手动验收清单：[manual-checklist.md](./manual-checklist.md)

## 批次测试 · 批次 1（第 2 期，任务 1–7）· 2026-11-03 04:58

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <12 个改动文件>`（apps/native 11 个 + `biome.json`） | 通过 | 0 错误（全量 `pnpm check` 有历史遗留错误，不作为闸门） |
| 类型 | `pnpm -F native check-types` | 通过 | `tsc --noEmit`，直接运行（无缓存） |
| 类型 | `pnpm check-types` | 通过 | 7/7 包（turbo 缓存命中，输入未变） |
| 构建（App） | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 产出 `entry-*.hbc`（7.8MB）；bundle 中能找到 `users.sl-ai-admin.local`、`USERNAME_IS_ALREADY_TAKEN`、`sign-in/username`、`usernameClient`，说明 Metro 解析了 `@sl-ai-admin/auth/credentials` 和 username 插件；`dist/` 已被 gitignore |
| 构建（Web/Server） | `pnpm build` | 通过 | 3/3（web、server、fumadocs） |
| 单元 | `pnpm test` | 通过 | Vitest 30 个用例（`packages/auth/src/credentials.test.ts`，移动端与 Web 共用的规则、提示语、错误码映射） |
| 接口 | 临时脚本（模拟 Expo 客户端：`expo-origin: sl-ai-admin://` + 手动 `Cookie` 头），对 `pnpm -F server dev` 逐条调用，并用 native 表单同样的 `getSignUpErrorMessage` / `getSignInErrorMessage` 映射出 toast 文案 | 通过 | 10 项检查全过，见下方明细；测试用户已删除，脚本未提交，server 已停 |
| E2E（Web 回归） | `pnpm test:e2e` | 通过 | Playwright 20 个用例；本批未改 Web / server 代码，只因 `biome.json`、`pnpm-lock.yaml` 变动做回归 |
| E2E（App） | — | 未运行 | 移动端没有 Detox / Maestro；按第 1 期 W2 决定，App 界面由用户在模拟器手动验收（见 manual-checklist.md） |

### 接口检查明细

| 检查 | 结果 | 实际返回 |
|------|------|----------|
| AC3 新用户名 `E2e_Mob…` 注册 → 200 且建立会话 | 通过 | `displayUsername` 与输入大小写一致，`username` 为小写 |
| AC3 占位邮箱 | 通过 | `<小写用户名>@users.sl-ai-admin.local` |
| AC7 `/sign-out` 后会话为空 | 通过 | 200，`get-session` 返回 `null` |
| AC4 仅大小写不同的重复注册 | 通过 | 400 `USERNAME_IS_ALREADY_TAKEN` → toast「用户名已被注册」 |
| AC5 错误密码 | 通过 | 401 `INVALID_USERNAME_OR_PASSWORD` → toast「用户名或密码错误」 |
| AC5 不存在的用户名 | 通过 | 401 `INVALID_USERNAME_OR_PASSWORD` → toast「用户名或密码错误」 |
| AC5 两种失败的响应完全相同 | 通过 | 状态码与错误码一致 |
| AC5 小写用户名 + 正确密码登录 | 通过 | 200，会话 `displayUsername` 为注册时的原样 |
| R5 受保护的 tRPC `privateData` | 通过 | 未登录 401，带会话 200 |
| AC5 服务器不可达 | 通过 | better-auth 客户端直接抛错、不调用 `onError`，证明表单外层 try/catch 是必要的（catch 里 toast「登录失败，请稍后重试」） |

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | 手动（模拟器）——界面切换无法自动化 | 未验证 | 待用户按 manual-checklist.md 验收；代码：`app/sign-in.tsx` 默认登录、可切换 |
| AC2 | Vitest `signUpSchema › reports each field error on its own path`（`ab` / `1234567` / `x` → 三条与 Web 相同的提示）；界面上显示在输入框下方需手动确认 | 规则通过，界面未验证 | 表单 `validators.onSubmit = signUpSchema`，校验失败时 TanStack Form 不调用 `onSubmit`，不会发请求 |
| AC3 | 接口检查（注册 → 会话 → `displayUsername`）+ 手动（进入首页并显示「欢迎，<用户名>」） | 接口通过，界面未验证 | 见接口检查明细 |
| AC4 | 接口检查（大小写不同的重复注册 → 「用户名已被注册」） | 接口通过，界面未验证 | 见接口检查明细 |
| AC5 | 接口检查（错误密码 / 不存在用户 / 正确登录 / 服务器不可达） | 接口通过，界面未验证 | 见接口检查明细 |
| AC6 | 手动（`xcrun simctl openurl` / `adb` 深链接）——需要运行中的 App | 未验证 | 代码：`app/_layout.tsx` 用 `Stack.Protected guard={isSignedIn}` 包住抽屉 / Tabs / Modal，未登录时这些路由不注册 |
| AC7 | 接口检查（`/sign-out` 后会话为空）+ 手动（回到登录页、杀进程重开） | 接口通过，界面未验证 | `components/user-menu.tsx` 调 `authClient.signOut()` 后 `queryClient.clear()` |
| AC8 | 手动（观察按钮状态） | 未验证 | 代码：两张表单都用 `form.Subscribe(isSubmitting)` 控制 `isDisabled` 和 `Spinner` |
| AC9 | `pnpm -F native check-types` + `expo export --platform ios` | 通过 | 见上表 |

> 说明：本机只有 Xcode 15.3 / iOS 17.4 模拟器运行时，可能不满足 Expo SDK 58 / RN 0.88；有 Android AVD（Pixel_4_XL_API_31、Pixel_XL_API_31）。项目没有移动端 UI 自动化框架，本节点也没有可驱动模拟器的工具，因此 AC1–AC8 的界面部分标为「未验证」，交由用户按 manual-checklist.md 验收。

### 失败与修复

- 无测试失败，`fixRounds` = 0。

## 回归测试 · 批次 1（第 2 期，Codex 评审 cp03-03-native-username-auth 之后）· 2026-11-03 05:06

Codex 评审 0 条、未改代码（工作区只多了两个评审记录文件），本次回归确认提交 6500e20 的状态。

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <55c7126..6500e20 改动的 12 个 ts/tsx/json 文件>` | 通过 | 0 报错 |
| 类型（App） | `pnpm -F native check-types` | 通过 | 退出码 0 |
| 类型（全量） | `pnpm check-types` | 通过 | 7/7（turbo 缓存命中，输入未变） |
| 构建（Web/Server） | `pnpm build` | 通过 | 3/3（turbo 缓存命中，输入未变） |
| 构建（App） | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 删掉旧 dist 后重新导出；`ios/entry-*.hbc` 中能找到 `usernameClient`、`INVALID_USERNAME_OR_PASSWORD` |
| 单元 | `pnpm test` | 通过 | Vitest 30 个用例 |
| E2E（Web 回归） | `pnpm test:e2e` | 未运行 | 批次测试后没有改过任何代码，批次测试时 20 个用例已通过；本 feature 不涉及 Web |
| E2E（App） | — | 未运行 | 移动端没有 Detox / Maestro，按第 1 期 W2 决定由用户在模拟器手动验收 |

### 验收标准覆盖

与批次测试一致：AC9 通过；AC3 / AC4 / AC5 / AC7 的接口部分在批次测试中已通过；AC1–AC8 的界面部分仍为「未验证」，待用户按 manual-checklist.md 在模拟器验收。

### 失败与修复

- 无测试失败，`fixRounds` = 0。
