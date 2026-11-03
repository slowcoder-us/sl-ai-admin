# final-r2 评审结论（第 2 期整体评审）

评审者：Codex（/codex:review，codex-cli 0.166.0） · 范围：sl/sl-ai-admin-base...1ecbd7e（第 2 期整个分支，起点 55c7126） · 日期：2026-11-03
原始输出：[final-r2-codex.md](./final-r2-codex.md)
统计：共 1 条，采纳 1，不采纳 0，需你决定 0

> 编号说明：第 1 期的整体评审已存为 `final-codex.md` / `final-decision.md`（范围 a9c3ad2..3d7afa4）。为保留第 1 期结论不被覆盖，本期整体评审用编号 `final-r2`。

| 序号 | 级别 | 位置 | 问题摘要 | 结论 | 理由 | 修复 |
|------|------|------|----------|------|------|------|
| 1 | P2 | apps/native/app/sign-in.tsx:12-13 | 登录 / 注册页不随键盘调整，iOS 上键盘弹出后，居中表单下方的输入框和提交按钮可能被挡住 | 采纳 | 已核实：`components/container.tsx` 用的是普通 `ScrollView`，没有设置 `automaticallyAdjustKeyboardInsets`，也没有使用键盘感知组件；根布局的 `KeyboardProvider` 本身不会调整内容区域。新页面内容不超过一屏，没有可滚动的范围，所以无法把被挡住的控件滚上来。注册表单有 3 个输入框，最可能受影响 | `sign-in.tsx` 改为 `Container isScrollable={false}`，内部包一层 `react-native-keyboard-controller` 的 `KeyboardAwareScrollView`（`bottomOffset=24`，其余 ScrollView 属性与 Container 保持一致）。iOS / Android 都生效，库已在依赖里，不新增依赖；共享的 `Container` 不改动，不影响其他页面。ultracite 和 `pnpm -F native check-types` 通过。界面行为无法自动测试，已在 `03-native-username-auth/manual-checklist.md` 补了一条键盘验收项 |

## Claude 跨 feature 复核

- **重复实现**：
  - 用户名 / 密码校验、提示语、错误码映射都只从 `@sl-ai-admin/auth/credentials` 引入。移动端登录用 `getSignInErrorMessage`、`AUTH_MESSAGES`，注册用对应的 schema，没有另写一份规则。
  - `apps/native/lib/display-name.ts` 和 `apps/web/src/lib/display-name.ts` 的 `getDisplayName` 是同样的一行逻辑。这是 03 design.md 明确写的做法（“与 Web 同规则”），不算问题。
  - 以后如果显示名规则要改，两端都得改。可以考虑把它移到 `packages/auth/credentials`，记入遗留问题，本期不改。
- **接口风格**：调用方式和 Web 一致：
  - 登录：`authClient.signIn.username`；
  - 注册：`signUp.email` 加占位邮箱；
  - 移动端客户端已加 `usernameClient()`。
  - 移动端另外用 try/catch 处理了网络异常，Web 表单没有处理。这一条已经在 leftovers 里。
- **共享代码有没有被改坏**：
  - 本期没有改 `packages/*`。
  - 对共享配置的改动只有两处：
    - `biome.json` 的 `noJsxPropsBind` 关闭范围加上了 `apps/native/**`，只放宽 lint，不影响 Web；
    - `AGENTS.md` 目录说明。
  - W8 全量测试时，Web 的 20 个 E2E 用例全部通过，01 / 02 没有回归。
