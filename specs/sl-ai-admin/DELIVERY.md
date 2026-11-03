# sl-ai-admin 登录注册 交付报告

分支：`sl/sl-ai-admin`（`a9c3ad2..HEAD`，两期共 17 个提交，未推送）
- 第 2 期（移动端）：`55c7126..HEAD`，7 个提交，日期 2026-11-03
- 第 1 期（Web）：`a9c3ad2..55c7126`，10 个提交，日期 2026-11-02

需求：`docs/登录需求.md`。第 1 期按用户决定只做后端 + Web，移动端暂缓；第 2 期按用户要求补做移动端（03）。需求文档两期之间没有变化，没有重新拆分。

## 完成情况

| Feature | 任务 | 验收标准 | 提交 |
|---------|------|----------|------|
| 01-username-account 用户名注册 / 登录（后端 + Web） | 11/11 | AC1–AC10 通过 | `d097b96` 功能、`2239acb` 评审修复 |
| 02-web-access-control 访问控制与退出 | 7/7 | AC1–AC6 通过 | `bc883fc` 功能、`3d7afa4` 评审记录 |
| 03-native-username-auth 移动端用户名登录注册（第 2 期） | 7/7 | AC9 通过；**AC1–AC8 待你在模拟器手动验收** | `6500e20` 功能、`1687d21` 评审记录、`9ee6d53` 整体评审修复 |

03 的 AC1–AC8 是界面行为，项目没有移动端 UI 自动化（Detox / Maestro），按第 1 期 W2 的决定由你在模拟器上手动验收，清单见 [manual-checklist.md](./03-native-username-auth/manual-checklist.md)。对应的底层行为已经用模拟 Expo 客户端的接口检查覆盖（注册、重复用户名、错误密码、登录、退出，见 [03 测试记录](./03-native-username-auth/test-report.md)），但界面本身还没有人看过。

其他提交：
- 第 2 期：`1ecbd7e` 全量测试记录、`3306329` 安全审查与依赖审计记录、`0c17969` 文档同步、本报告。
- 第 1 期：`8ae2a6f` 修 Biome 配置、`1be9da6` specs 拆分、`a254f09` 文档同步与整体评审记录、`d32ac4a` 第 1 期交付报告、`f061d0a` E2E 自动清理临时用户、`55c7126` 补记拆分记录。

第 2 期改动的代码只在 `apps/native`，另外改了 `biome.json`（对 `apps/native/**` 关闭 `noJsxPropsBind`）和 `pnpm-lock.yaml`（只多了一条 workspace 链接）。没有改 server、web 或 `packages/*`。

## 测试

### 第 2 期（2026-11-03，03 移动端）全量测试

干净环境：删除全部 `node_modules`、`.turbo`、`.next`、`apps/native/dist`、server `dist` 和 Prisma 生成的客户端，然后执行 `pnpm install --frozen-lockfile` 和 `pnpm db:generate`。E2E 在新建的空库 `sl_delivery_check` 上运行，测完已删除。Node 版本是 v26.13.0；安装时 Prisma preinstall 提示“只支持 20.19+ / 22.12+ / 24.0+”，但生成、迁移、运行都正常。

| 类别 | 命令 | 结果 |
|------|------|------|
| lint | 第 2 期改动的 12 个 ts/tsx/json 文件：`ultracite check` | 0 错误 |
| lint | 两期累计改动的 40 个 ts/tsx/json 文件：`ultracite check` | 0 错误；2 条 info，和第 1 期相同，是 fumadocs `biome.json` 的配置弃用提示 |
| 类型 | `pnpm check-types --force` | 7/7 通过，0 缓存（包含 native） |
| 类型 | `pnpm -F native check-types` | 通过 |
| 构建 | `pnpm build --force` | 3/3 通过，0 缓存，识别到 Proxy |
| 移动端打包 | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过；ios hbc 中能找到 `usernameClient`、`INVALID_USERNAME_OR_PASSWORD` |
| 移动端打包 | `expo export --platform android`（输出到临时目录） | 通过（额外检查，方便改用 Android 模拟器验收） |
| 单元 | `pnpm test --force` | 30 个用例通过 |
| 迁移 | 空库 `prisma migrate deploy` | 通过（1 个迁移） |
| E2E（Web 回归） | `pnpm test:e2e`（`DATABASE_URL` 指向空库） | 20 个用例通过。空库测完只剩 global-setup 创建的共享账号 `test`，临时用户已被 teardown 清理，说明这次确实用了新库 |

移动端没有自动化 UI 测试（没有 Detox / Maestro）。03 的 AC1–AC8 界面部分还**没有验证**，需要用户按 [manual-checklist.md](./03-native-username-auth/manual-checklist.md) 在模拟器上手动验收。逐条证据见 [03 测试记录](./03-native-username-auth/test-report.md)。

本次全量测试没有发现问题，也没有修复提交。

### 第 1 期（2026-11-02，Web）全量测试

交付前在干净环境全量跑一遍（`pnpm install --frozen-lockfile`、清空 `.next` / `.turbo` 缓存、`--force` 重建、E2E 跑在新建的空库 `sl_delivery_check` 上，测完删除）：

| 类别 | 命令 | 结果 |
|------|------|------|
| lint | 分支内 26 个改动文件 `ultracite check` | 0 错误（2 条 info：fumadocs 配置的 schema 版本提示） |
| 类型 | `pnpm check-types --force` | 7/7 通过 |
| 构建 | `pnpm build --force` | 3/3 通过，识别到 Proxy |
| 单元 | `pnpm test --force` | 30 个用例通过 |
| E2E | `pnpm test:e2e`（`DATABASE_URL` 指向空库） | 20 个用例通过（空库中产生 12 个测试用户，证明确实用了新库） |
| 迁移 | 空库 `prisma migrate deploy` | 通过 |

各 feature 的逐条 AC 证据见 [01 测试记录](./01-username-account/test-report.md)、[02 测试记录](./02-web-access-control/test-report.md)。无手动验证项。

## 代码评审

每个提交点只评审一轮（用户要求），修复后不再送审。

| 评审 | Codex 提出 | 采纳 | 不采纳 | 需你决定 | 结论文件 |
|------|-----------|------|--------|----------|----------|
| cp01（01 功能） | 3 | 3（+ Claude 自查 1） | 0 | 0 | [cp01-…-decision.md](./reviews/cp01-01-username-account-decision.md) |
| cp02（02 功能） | 0 | 0 | 0 | 0 | [cp02-…-decision.md](./reviews/cp02-02-web-access-control-decision.md) |
| final（第 1 期整个分支，`a9c3ad2..3d7afa4`） | 0 | 0 | 0 | 0 | [final-decision.md](./reviews/final-decision.md) |
| cp03（03 功能，第 2 期） | 0 | 0 | 0 | 0 | [cp03-…-decision.md](./reviews/cp03-03-native-username-auth-decision.md)（记录提交 `1687d21`） |
| final-r2（第 2 期整个分支，`55c7126..1ecbd7e`） | 1 | 1 | 0 | 0 | [final-r2-decision.md](./reviews/final-r2-decision.md)（修复提交 `9ee6d53`） |

第 2 期的整体评审编号用 `final-r2`，这样不会覆盖第 1 期的 `final` 结论。

final-r2 采纳的问题（P2）：登录 / 注册页不随键盘调整，iOS 上键盘弹出后，下方输入框和提交按钮可能被挡住。修法：`apps/native/app/sign-in.tsx` 改用 `react-native-keyboard-controller` 的 `KeyboardAwareScrollView`（依赖已有，不新增），共享的 `Container` 没有改。键盘行为没法自动测试，已在手动验收清单里加了一条。final-r2 的 Claude 跨 feature 复核结论：校验规则只从 `@sl-ai-admin/auth/credentials` 引入，没有另写一份；移动端和 Web 的接口调用方式一致；本期没有改共享代码，Web 的 20 个 E2E 用例全部通过，01 / 02 没有回归。

cp01 采纳的问题：注册可不带用户名、注册后可改用户名 / 显示名 / name、注册时可伪造 displayUsername。均已修复并补了能复现问题的 E2E 用例（回退修复后这些用例会失败）。

## 安全与依赖

### 第 2 期（2026-11-03，03 移动端）

**安全审查**（`security-review` skill 依赖 `origin/HEAD`，本仓库的 origin 没有这个引用，调用失败；改为按清单逐项检查 `55c7126..9ee6d53` 的改动）：
- **接口 / 越权**：本期没有改 `apps/server`、`apps/web`、`packages/*`，没有新增接口。移动端只调用已有的 Better Auth 接口和 tRPC 的 `healthCheck` / `privateData`，鉴权仍在服务端完成。
- **路由保护**：根布局用 `Stack.Protected` 守卫。没有会话时只能进入 `sign-in`，`(drawer)`、`(tabs)` 和 `modal` 都进不去，用深链接也绕不过去。
- **输入校验 / 注入 / XSS**：用户名和密码的规则统一来自 `@sl-ai-admin/auth/credentials`（zod），服务端 `hooks.before` 仍会强制改写 email 和 name。RN 的 `<Text>` 不解析 HTML，也没有 WebView、`eval` 或拼接 SQL。
- **会话与密钥**：session 保存在 `expo-secure-store` 中，`storage` 只传了 get / set 四个函数。退出登录时调用 `queryClient.clear()`，避免下一个登录的账号看到上一个账号的缓存数据。代码里没有 `console.*`，也没有把 token 写进日志。
- **错误提示**：登录失败按状态码映射成同一句中文提示，不区分“用户名不存在”和“密码错误”，不暴露服务端原始报错。
- **打包产物**：检查了 `expo export` 生成的 iOS hbc。
  - 里面没有 Prisma、`pg`、`DATABASE_URL` 或服务端 `createAuth`；
  - 本机 `apps/server/.env` 里的 `BETTER_AUTH_SECRET` 值不在产物中，只出现了 `@better-auth/core` 环境变量读取代码里的这个变量名；
  - `@sl-ai-admin/auth/credentials` 只依赖 zod，没有把服务端代码打进 App。
- **不适用**：文件上传、对外请求（SSRF）。
- 结论：**没有发现新的安全问题**。已有的风险（用户名可被枚举、限流只在生产环境开启）见「遗留问题」。

**依赖审计**（`pnpm audit --prod --registry=https://registry.npmjs.org`）：仍然是第 1 期那 4 个，高 1、中 2、低 1，没有严重级别。全部由 Expo / shadcn 工具链带入：
- zod < 4.6.6 来自 `@expo/cli`。我们自己的代码用的 zod 是 4.6.7，App 运行时也用这个版本。
- minimatch、glob、deepmerge 来自 `@expo/config` 等配置工具。

本期 `pnpm-lock.yaml` 只多了 `apps/native → @sl-ai-admin/auth` 这一条 workspace 链接，**没有新增或升级任何外部依赖**，所以不需要处理，也不需要你确认升级。

### 第 1 期（2026-11-02，Web）

**安全审查**（`security-review` skill 需要远程分支，本仓库无 remote，改为按清单手动检查）：
- 没有新增 tRPC 接口；`privateData` 未登录返回 401 已有测试固定
- 身份字段：注册必须带用户名，email / name / displayUsername 由服务端从用户名派生，注册后不可修改；邮箱登录接口已禁用
- 无原生 SQL、`dangerouslySetInnerHTML`、`eval`、命令执行；用户名只允许字母数字下划线，React 默认转义
- 重定向目标都是固定路径，无开放重定向；代码中无密钥，仓库只跟踪 `.env.schema`

**依赖审计**（`pnpm audit --prod --registry=https://registry.npmjs.org`，项目默认的 npmmirror 不支持 audit）：4 个，**均为既有依赖带入，不是本分支新增**：

| 级别 | 包 | 来源 |
|------|----|------|
| 高 | zod < 4.6.6 | `@expo/cli`（移动端工具链）；我们自己代码用的 zod 是 4.6.7，不受影响 |
| 中 | minimatch < 11.0.1 | shadcn、expo 配置工具 |
| 中 | glob 9–14.0.1 | expo 配置工具 |
| 低 | deepmerge 4.2–4.3.1 | shadcn、expo（无修复版本） |

本分支新增的依赖只有开发依赖 `vitest`、`@playwright/test`，没有新增漏洞。

## 新增的经验沉淀

### 第 2 期（2026-11-03）

AGENTS.md 正文：
- 目录结构补充了 native 的新文件：`sign-in` 页、`user-menu`、`lib/display-name.ts`、`lib/form-error.ts`、`auth-client.ts` 含 `usernameClient`。
- 「鉴权流程」补充了移动端的登录保护：根布局用 `Stack.Protected guard={isSignedIn}`，新增需要登录的页面放进 `(drawer)` 或同一个分组。
- 「常用命令」加了一行：移动端类型检查 `pnpm -F native check-types` 和打包检查 `expo export --platform ios`，界面行为按手动验收清单验收。

「经验沉淀」小节新增 5 条：
- `useSession()` 的 `isPending` 每次重新拉取都会变回 `true`，根布局只能在首次加载时用它显示 Spinner，否则提交中的登录表单会被卸载
- 服务器不可达时 better-fetch 直接 throw、不调 `onError`，`signIn` / `signUp` 要包 `try/catch`
- `@better-auth/expo` 的 `signOut` 先清 SecureStore，离线也能本地退出，之后再 `queryClient.clear()`
- Biome 类型推断误报：`useRef<T | null>` 的写法，以及 react-query `isLoading` 被误判
- Expo SDK 58 + pnpm monorepo：只加 `workspace:*` 依赖，Metro 不用改配置就能解析内部包

另外，已有的「环境·数据库」条目补了一句：Homebrew 4.3 在 macOS 27 上会崩溃，先 `brew update`。

### 第 1 期（2026-11-02）

AGENTS.md 正文新增：账号是用户名制的约定（注册 / 登录写法、身份字段不可改、共享校验模块）、`pnpm test` / `pnpm test:e2e` 命令。「经验沉淀」小节新增 8 条：
- 本机 PostgreSQL 17（Homebrew）的启动与账号
- 先 `pnpm db:generate` 再起 server
- 非 TTY 下 `db:migrate` 的替代命令
- 只 lint 改动文件的命令（zsh 需 xargs）
- Biome tab 缩进导致整文件重排，review 用 `git diff -w`
- E2E 直连 auth 接口要带 Origin、随机用户名、15s 断言超时
- base-ui `Button` 当链接会变成 `role="button"`
- 登录拦截两层结构（Proxy 乐观 + 页面 `getServerSession()`）

## 遗留问题

**需要你做的事**
1. **⚠️ 03 的 AC1–AC8 还没有验收**：按 [manual-checklist.md](./03-native-username-auth/manual-checklist.md) 在模拟器上逐条操作，包括 final-r2 修复后新增的键盘一项，把结果填进清单的「结果」列。验收通过后再把 `03-native-username-auth/requirements.md` 的 AC1–AC8 打勾。在此之前不要发布移动端。
2. 本机是 Xcode 15.3，只装了 iOS 17.4 模拟器运行时，可能达不到 Expo SDK 58 / RN 0.88 的构建要求。iOS 开发版构建失败时，先升级 Xcode，或者改用 Android 模拟器（Android SDK 已装，`expo export --platform android` 已验证能打包）。
3. 3000 端口上还有一个本次工作流早先启动的 `pnpm dev:server`（PID 44632，监听进程 PID 44709，连的是默认开发库）。工作流里没能停掉它，请你自己关掉：`kill 44632 44709`。如果你正打算按下面的步骤启动后端，也可以直接复用它。

**超出本期范围的问题**

4. Web 的登录 / 注册表单（`apps/web/src/components/sign-in-form.tsx`、`sign-up-form.tsx`）没有处理 better-fetch 的网络异常：服务器不可达时不会提示「登录失败，请稍后重试」，还会产生未处理的 Promise rejection。移动端 03 已经用 try/catch 处理了，Web 可以照着改。
5. `getDisplayName` 在移动端和 Web 各有一份，逻辑相同（`apps/native/lib/display-name.ts`、`apps/web/src/lib/display-name.ts`）。这是 03 design.md 有意的做法，但以后显示名规则要改时两端都得改。可以考虑移到 `packages/auth/credentials`。
6. 全量 `pnpm check` 有 451 个脚手架遗留的 lint 错误（多为排序类，可自动修复），两期都没有处理，提交闸门只检查改动文件。建议单独做一次「全量 `pnpm fix`」的清理提交。
7. 部署时如果 web 和 server 不在同一域名，`proxy.ts` 读不到会话 cookie（cookie 在 server 域名下）。页面里的 `getServerSession()` 仍会正确拦截，但 Proxy 的提前跳转会失效。跨域部署方案不在本期范围。
8. Better Auth 的接口限流默认只在生产环境（`NODE_ENV=production`）开启，开发环境下登录接口可以被暴力尝试。
9. 「用户名已被注册」提示（PRD 要求）和默认开启的 `/is-username-available` 接口都能用来探测用户名是否存在。如需防枚举，可以在 `disabledPaths` 加上 `/is-username-available`。
10. 依赖审计列出的 4 个既有漏洞（zod < 4.6.6 高、minimatch 中、glob 中、deepmerge 低），都来自 Expo / shadcn 工具链，需要随它们升级处理。
11. 本机 Node 是 v26.13.0，不在 Prisma 声明支持的版本里（20.19+ / 22.12+ / 24.0+），`pnpm install` 时 preinstall 会警告。实际生成、迁移、运行都正常，CI / 部署环境建议用 Node 24 LTS。

**已解决**
- ~~移动端现有的登录已失效~~（第 1 期遗留第 1 条）：03 已经把移动端改成用户名登录注册，并加了登录保护。
- ~~本地开发库里留有 E2E 产生的测试用户~~（第 1 期遗留第 6 条）：E2E 跑完会自动删除临时用户，只保留共享账号 `test` / `test1234`。

## 如何验证

```bash
brew services start postgresql@17          # 本机数据库（已设为开机自启）
pnpm install
pnpm db:generate
pnpm -F @sl-ai-admin/db exec prisma migrate deploy
pnpm dev:server                            # 终端 1，:3000
pnpm dev:web                               # 终端 2，:3001（验证 Web 时）
```

可以用共享测试账号 `test` / `test1234` 登录，也可以自己注册。Web 和移动端共用账号。

### Web 关键路径
1. 打开 http://localhost:3001/dashboard → 自动跳到 `/login`
2. 点「还没有账号？去注册」→ 用户名 `Alice_01`、密码 8 位以上 → 注册后进入后台，显示「欢迎，Alice_01」
3. 右上角点用户名 → 「退出登录」→ 回到登录页；再访问 `/dashboard` 仍被拦回
4. 用 `alice_01`（大小写不同）+ 错误密码登录 → 提示「用户名或密码错误」；密码正确则登录成功
5. 已登录时打开 `/login` → 直接进入 `/dashboard`

### 移动端关键路径（第 2 期，需要你手动验收）

先设置 `apps/native/.env` 的 `EXPO_PUBLIC_SERVER_URL`：iOS 模拟器用 `http://localhost:3000`，Android 模拟器用 `http://10.0.2.2:3000`（改完重启 Metro）。然后：

```bash
pnpm -F native ios          # 首次构建开发版（Android 用 pnpm -F native android）
pnpm dev:native             # 之后只需启动 Metro
```

1. 未登录冷启动 → 只看到登录表单，可以切到注册再切回
2. 注册表单输入不合法的值 → 三个输入框下方显示和 Web 相同的错误，不发请求
3. 用新用户名注册 → 进入首页，显示「欢迎，<用户名>」；在注册表单点「确认密码」时，键盘不挡住输入框和「注册」按钮
4. 错误密码、不存在的用户名登录 → 都提示「用户名或密码错误」；用已存在用户名的不同大小写注册 → 提示「用户名已被注册」
5. 未登录时打开深链接 `sl-ai-admin://two`（iOS：`xcrun simctl openurl booted sl-ai-admin://two`）→ 仍停在登录页
6. 右上角「退出登录」→ 回到登录页；杀掉 App 再打开仍是登录页

完整步骤和预期结果见 [manual-checklist.md](./03-native-username-auth/manual-checklist.md)。

### 自动化
- `pnpm test`：单元测试
- `pnpm test:e2e`：Web 端到端测试，需要数据库在运行；首次先执行 `pnpm -F web exec playwright install chromium`
- `pnpm -F native check-types`、`pnpm -F native exec expo export --platform ios --output-dir dist`：移动端类型检查和打包检查
