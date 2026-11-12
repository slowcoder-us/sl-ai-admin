## 批次测试 · 第 2 轮批次 1 · 2026-11-07 23:22

测试环境：主工作区，包含未提交的部署改动（`packages/db` 连接池 `max: 2`、`apps/server` 拆 `app.ts`、`apps/web/src/app/trpc`、`apps/web/src/app/api` 等，见状态文件 `workingTreeIgnore`）。提交点的代码不含这些改动，未单独测试。

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <本 feature 的 9 个文件>` | 通过 | 只查本 feature 的代码文件 |
| 类型 | `pnpm check-types` | 通过 | 8 个任务，其中 4 个命中 turbo 缓存；api、web、native、server 实际执行 |
| 类型 | `pnpm -F native check-types` | 通过 | |
| 单元 | `pnpm test --force` | 通过 | 59 个用例（api 29、auth 30），未用缓存 |
| 构建 | `pnpm exec turbo run build --filter=server --filter=fumadocs --filter='!web'` | 通过 | 2 个任务，其中 1 个命中缓存 |
| 构建 | `pnpm -F web build` | 通过 | 在仓库的临时克隆里执行，见下方说明 |
| 构建 | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 本批未改 native |
| 迁移 | `prisma migrate deploy`（临时空库） | 通过 | 2 个迁移全部应用，`user`、`github_profile` 表存在，临时库已删除 |
| E2E | `pnpm exec playwright test e2e/github-users.spec.ts` | 通过 | 10 个用例，AC5 请求真实 GitHub |
| E2E | `pnpm test:e2e`（全部用例） | 通过 | 30 个用例，W7a 打勾前补跑（2026-11-07 23:24），因为任务 6 的完成标准是这条命令 |

Web 构建说明：在主工作区执行 `pnpm build` 时 web 失败，报 `Another next build process is already running`。原因是 Antigravity IDE 在 05:12 启动的 `pnpm -F web build`（PID 49124）一直未退出，持有 `apps/web/.next/lock`。该进程不是本工作流启动的，没有终止。改用 `cp -cR` 克隆整个工作区，在克隆里构建，构建后删除克隆。这个失败与代码无关，不计入修复轮次。

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | E2E `AC1: the dashboard links to GitHub user management` | 通过 | |
| AC2 | E2E `AC2: signed-out visitors are sent to /login` | 通过 | |
| AC3 | E2E `AC3: lookup returns 401 without a session`（直接请求接口）；单元 `rejects signed-out callers without calling GitHub` | 通过 | |
| AC4 | E2E `AC4: -abc / a--b / 40 个 a shows one Chinese hint and sends no request`（3 个用例） | 通过 | |
| AC5 | E2E `AC5: octocat shows the public profile and a new-tab link`（真实 GitHub） | 通过 | |
| AC6 | E2E `AC6: empty profile fields are not shown`（模拟接口）；单元 `keeps empty profile fields as null` | 通过 | |
| AC7 | 单元 `maps GitHub status 404 / 403 / 429 / 500`、`reports a timeout and gives GitHub 5 seconds`、`reports a body of the wrong shape`、`reports a body that is not JSON`（stub fetch） | 通过 | |
| AC8 | E2E `AC8: a lookup error appears once, with no toast`（模拟接口） | 通过 | |
| AC9 | E2E `AC9: searching shows progress and disables the button`（模拟接口） | 通过 | |

### 失败与修复

无代码失败，`fixRounds` 为 0。

## 回归测试 · 第 2 轮批次 1 · 2026-11-07 23:35

测试环境：主工作区，提交点 8534452，包含未提交的部署改动（见状态文件 `workingTreeIgnore`）。提交点的代码不含这些改动，未单独测试。W5 评审没有修复，业务代码和测试的修改时间最晚是 23:18:48，批次测试之后没有再改。

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <本 feature 的 9 个文件>` | 通过 | 实际检查 9 个文件 |
| 类型 | `pnpm check-types` | 通过 | 8 个任务全部命中 turbo 缓存，输入自批次测试后未变 |
| 类型 | `pnpm -F native check-types` | 通过 | 实际执行 |
| 单元 | `pnpm test` | 通过 | 59 个用例（api 29、auth 30），2 个任务全部命中 turbo 缓存，没有重新执行 |
| 构建 | `pnpm exec turbo run build --filter=server --filter=fumadocs --filter='!web'` | 通过 | 2 个任务全部命中缓存 |
| 构建 | `pnpm -F web build` | 通过 | 实际执行，在临时克隆里（克隆时删除 `.next`），构建后已删除克隆。PID 49124 仍持有主工作区 `apps/web/.next/lock` |
| 构建 | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 实际执行 |
| 迁移 | `prisma migrate deploy`（临时空库） | 未运行 | 提交点没有改 `packages/db/prisma`，批次测试已在空库执行过 |
| E2E | `pnpm exec playwright test e2e/github-users.spec.ts` | 通过 | 实际执行，10 个用例，AC5 请求真实 GitHub |

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1、AC2、AC4、AC5、AC6、AC8、AC9 | 本次重跑的 E2E，用例同批次测试 | 通过 | |
| AC3 | 本次重跑的 E2E `AC3: lookup returns 401 without a session`；单元用例命中缓存 | 通过 | |
| AC7 | 单元用例（stub fetch），命中 turbo 缓存，没有重新执行 | 通过 | 批次测试 `pnpm test --force` 实际执行过 |

### 失败与修复

无代码失败，`fixRounds` 为 0。
