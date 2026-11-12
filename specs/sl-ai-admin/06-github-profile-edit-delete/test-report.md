# GitHub 用户修改与删除（Web） - 测试记录

## 批次测试 · 第 2 轮批次 3 · 2026-11-08 00:00

测试环境：主工作区，提交 2b34456 加上 06 未提交的 7 个文件，同时包含未提交的部署改动（见状态文件 `workingTreeIgnore`）。未单独测试不含这些部署改动的代码。

| 类别 | 命令 | 结果 | 说明 |
|------|------|------|------|
| lint | `pnpm exec ultracite check <06 改动的 7 个文件>` | 通过 | 实际检查 7 个文件，退出码 0 |
| 类型 | `pnpm check-types` | 通过 | 8 个任务全部命中 turbo 缓存（输入与 W4a 自检相同） |
| 类型 | `pnpm -F native check-types` | 通过 | 实际执行 |
| 单元 | `pnpm test` | 通过 | 83 个用例（api 53 实际执行，auth 30 命中 turbo 缓存） |
| 构建 | `pnpm exec turbo run build --filter=server --filter=fumadocs` | 通过 | 2 个任务，其中 1 个命中 turbo 缓存 |
| 构建 | `pnpm -F web build` | 通过 | 实际执行，在主工作区的临时副本里（不含 `.next`），构建后已删除副本。PID 49124 仍持有主工作区 `apps/web/.next/lock` |
| 构建 | `pnpm -F native exec expo export --platform ios --output-dir dist` | 通过 | 实际执行 |
| 迁移 | `prisma migrate deploy`（临时空库） | 通过 | 2 个迁移全部完成，`github_profile` 表存在，临时库已删除。06 没有改动迁移文件 |
| 接口 | 临时脚本调用真实 server 和本地 PostgreSQL | 通过 | 9 项，见下表。脚本不入库 |
| E2E | `pnpm -F web exec playwright test` | 通过 | 全量 43 个用例，20.9 秒，没有重跑（含 06 的 “edit and delete” 7 个） |
| 清理 | 查询本地库 | 通过 | 跑完后 `e2e_` 用户 0 个，其 `github_profile` 0 条，孤立的 `github_profile` 0 条 |

接口检查结果（账号 A、B 为临时注册的 `e2e_` 账号，记录直接插入数据库；每项之后都查询账号 A 的记录，确认数据未变）：

| 场景 | 状态码 | 错误码 | 提示 | 数据未变 |
|------|--------|--------|------|----------|
| `update` bio 501 字 | 400 | BAD_REQUEST | | 是 |
| `update` name 256 字 | 400 | BAD_REQUEST | | 是 |
| `update` location 256 字 | 400 | BAD_REQUEST | | 是 |
| 账号 B `update` 账号 A 的记录 | 404 | NOT_FOUND | 找不到该记录 | 是 |
| 账号 B `remove` 账号 A 的记录 | 404 | NOT_FOUND | 找不到该记录 | 是 |
| `update` 不存在的 ID | 404 | NOT_FOUND | 找不到该记录 | 是 |
| `remove` 不存在的 ID | 404 | NOT_FOUND | 找不到该记录 | 是 |
| 未登录 `update` | 401 | UNAUTHORIZED | | 是 |
| 未登录 `remove` | 401 | UNAUTHORIZED | | 是 |

GitHub 匿名额度：节点开始时剩 51，E2E 开始前剩 9，E2E 结束后剩 0（重置时间 2026-11-08 00:03 -1000）。E2E 开始前的 42 次消耗来源未查明，本节点没有排查。

### 验收标准覆盖

| AC | 验证方式 | 结果 | 证据 |
|----|----------|------|------|
| AC1 | E2E `AC1: the form is prefilled and only offers the three fields` | 通过 | |
| AC2 | E2E `AC2: edits show in the list and survive a reload` | 通过 | |
| AC3 | 接口检查（上表前 3 项）；单元 `rejects a bio over the limit without writing` | 通过 | |
| AC4 | E2E `AC4: cleared fields are no longer shown` | 通过 | |
| AC5 | E2E `AC5: cancelling an edit saves nothing` | 通过 | |
| AC6 | E2E `AC6: cancelling a delete keeps the record` | 通过 | |
| AC7 | E2E `AC7: a confirmed delete removes only that record` | 通过 | |
| AC8 | 接口检查（账号 B 两项）；单元 `reports another account's record as not found and keeps it` | 通过 | |
| AC9 | 接口检查（未登录两项）；单元 `rejects signed-out callers without writing`、`rejects signed-out callers without deleting` | 通过 | |
| AC10 | E2E `AC10: editing or confirming a delete locks the other records` | 通过 | |

未自动化的非 AC 项：R6 的“错误显示在编辑表单或删除确认处”和“进行中按钮禁用”没有自动化测试，W4a 通过读代码核对。

### 失败与修复

无失败，`fixRounds` 为 0。
