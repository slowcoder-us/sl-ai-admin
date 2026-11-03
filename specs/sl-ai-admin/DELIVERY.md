# sl-ai-admin 登录注册 交付报告

分支：`sl/sl-ai-admin`（`a9c3ad2..HEAD`，共 8 个提交，未推送）
日期：2026-11-02
需求：`docs/登录需求.md`（本期按用户决定只做 Web，移动端暂缓）

## 完成情况

| Feature | 任务 | 验收标准 | 提交 |
|---------|------|----------|------|
| 01-username-account 用户名注册 / 登录（后端 + Web） | 11/11 | AC1–AC10 通过 | `d097b96` 功能、`2239acb` 评审修复 |
| 02-web-access-control 访问控制与退出 | 7/7 | AC1–AC6 通过 | `bc883fc` 功能、`3d7afa4` 评审记录 |
| 03-native-username-auth 移动端 | 0/7 | — | **暂缓**（用户 2026-11-02 决定本期只做 Web） |

其他提交：`8ae2a6f` 修 Biome 配置、`1be9da6` specs 拆分、`a254f09` 文档同步、本报告。

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
| final（整个分支） | 0 | 0 | 0 | 0 | [final-decision.md](./reviews/final-decision.md) |

cp01 采纳的问题：注册可不带用户名、注册后可改用户名 / 显示名 / name、注册时可伪造 displayUsername。均已修复并补了能复现问题的 E2E 用例（回退修复后这些用例会失败）。

## 安全与依赖

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

1. **⚠️ 移动端现有的登录已失效**：`apps/native` 仍是邮箱登录 / 注册，而本期禁用了 `/sign-in/email` 并要求注册必须带用户名。恢复 03 后即可解决（03 的 specs 已写好，只依赖 01，可直接开工）。在那之前不要发布移动端。
2. 全量 `pnpm check` 有 451 个脚手架遗留 lint 错误（多为排序类，可自动修复），本期未处理，提交闸门改为只查改动文件。建议单独开一次「全量 `pnpm fix`」的清理提交。
3. 部署时 web 与 server 若不在同一域名，`proxy.ts` 读不到会话 cookie（cookie 在 server 域名下）。页面层 `getServerSession()` 仍会正确拦截，但 Proxy 的提前跳转会失效；跨域部署方案不在本期范围。
4. Better Auth 的接口限流默认只在生产环境（`NODE_ENV=production`）开启，开发环境下登录接口可被暴力尝试。
5. 「用户名已被注册」提示（PRD 要求）和默认开启的 `/is-username-available` 接口都能用来探测用户名是否存在。如需防枚举，可在 `disabledPaths` 加 `/is-username-available`。
6. ~~本地开发库里留有 E2E 产生的测试用户~~ → 已解决（交付后追加）：已清理历史测试用户；E2E 现在跑完自动删除临时用户，只保留共享账号 `test` / `test1234`。
7. 上面依赖审计列出的 4 个既有漏洞，需要随 Expo / shadcn 升级处理。

## 如何验证

```bash
brew services start postgresql@17          # 本机数据库（已设为开机自启）
pnpm install
pnpm db:generate
pnpm -F @sl-ai-admin/db exec prisma migrate deploy
pnpm dev:server                            # 终端 1，:3000
pnpm dev:web                               # 终端 2，:3001
```

关键路径（可用共享测试账号 `test` / `test1234` 登录，也可自己注册）：
1. 打开 http://localhost:3001/dashboard → 自动跳到 `/login`
2. 点「还没有账号？去注册」→ 用户名 `Alice_01`、密码 8 位以上 → 注册后进入后台，显示「欢迎，Alice_01」
3. 右上角点用户名 → 「退出登录」→ 回到登录页；再访问 `/dashboard` 仍被拦回
4. 用 `alice_01`（大小写不同）+ 错误密码登录 → 提示「用户名或密码错误」；密码正确则登录成功
5. 已登录时打开 `/login` → 直接进入 `/dashboard`

自动化：`pnpm test`（单元）、`pnpm test:e2e`（端到端，需数据库在运行；首次先 `pnpm -F web exec playwright install chromium`）。
