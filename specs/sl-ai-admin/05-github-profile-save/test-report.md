# GitHub 用户保存与列表（Web） - 测试记录

## 批次测试 · 第 2 轮批次 2 · 2026-11-07 23:43

测试环境：主工作区，基于 6b7398e 加上本 feature 未提交的 4 个文件，同时包含未提交的部署改动（见状态文件 `workingTreeIgnore`）。未单独测试不含这些部署改动的代码。

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <本 feature 改动的 4 个文件>` | 通过 | 实际检查 4 个文件 |
| 类型 | `pnpm check-types` | 通过 | 8 个任务，4 个实际执行（含 web、server、native），4 个命中 turbo 缓存 |
| 类型 | `pnpm -F native check-types` | 通过 | 实际执行 |
| 单元 | `pnpm test` | 通过 | 69 个用例：api 39 个实际执行；auth 30 个命中 turbo 缓存（auth 未改动） |
| 构建 | `pnpm exec turbo run build --filter=server --filter=fumadocs --filter='!web'` | 通过 | 2 个任务，1 个实际执行，1 个命中缓存 |
| 构建 | `pnpm -F web build` | 通过 | 实际执行，在主工作区的临时克隆里（克隆时删除 `.next`），构建后已删除克隆。PID 49124 仍持有主工作区 `apps/web/.next/lock` |
| 构建 | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 实际执行 |
| 迁移 | `prisma migrate deploy`（临时空库） | 通过 | 2 个迁移全部应用，`github_profile` 的主键、`ownerId + githubId` 唯一索引、`ownerId + createdAt` 索引都存在；临时库已删除 |
| E2E | `pnpm test:e2e` | 通过 | 全量 36 个用例（本 feature 相关的 `saved profiles` 6 个），24.4 秒，`retries: 0`，没有重跑 |
| 清理 | 查询本地库 | 通过 | 跑完后 `e2e_` 用户 0 个，`e2e_` 账号的 `github_profile` 0 条，孤立的 `github_profile` 0 条 |

GitHub 匿名额度：跑前剩 22，跑后剩 13，全量 E2E 用了 9 次。

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | E2E `AC1, AC2: a saved user persists and cannot be saved twice`（真实 GitHub，含刷新后仍在）；单元 `saves the latest GitHub profile under the signed-in account` | 通过 | |
| AC2 | E2E 同上（提示「该用户已保存」，列表仍只有一条）；单元 `reports a repeated save as CONFLICT` | 通过 | |
| AC3 | 单元 `treats a renamed GitHub user as the same user`（内存假 db） | 通过 | 真实唯一约束由 E2E AC2 覆盖 |
| AC4 | E2E `AC4, AC6, AC7: each account has its own list`（lookup 模拟，add 真实请求 GitHub）；单元 `lets different accounts save the same GitHub user` | 通过 | |
| AC5 | E2E `AC5: the latest save is listed first`（lookup 模拟，add 真实请求 GitHub）；单元 `returns only the current account's records, newest first` | 通过 | |
| AC6 | E2E `AC4, AC6, AC7: each account has its own list` | 通过 | |
| AC7 | E2E 同上；单元 `returns only the current account's records, newest first` | 通过 | |
| AC8 | E2E `AC8: add and list return 401 without a session`（直接请求接口）；单元 `rejects signed-out callers without calling GitHub or saving`、`rejects signed-out callers` | 通过 | |
| AC9 | E2E `AC9: saving disables the search and save buttons`、`AC9: a list error appears once, with no toast`（模拟接口） | 通过 | |

### 失败与修复

无失败，`fixRounds` 为 0。
