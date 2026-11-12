# Web 部署到 Cloudflare - 任务

> 需求：[requirements.md](./requirements.md) · 设计：[design.md](./design.md)
> 状态规则：未完成 `- [ ]`，完成后改为 `- [x]`；子任务全部完成后才勾选父任务。
> 验证命令：`pnpm -F web exec opennextjs-cloudflare build`（来自 `.github/workflows/deploy.yml`）、`pnpm check-types`、`pnpm exec ultracite check <本 feature 改动的文件>`

- [ ] 1. 核对 Cloudflare 构建配置
  - 内容：确认 Worker 名称、`nodejs_compat`、静态资源绑定和环境变量声明，并完成构建
  - 文件：`apps/web/wrangler.jsonc`、`apps/web/open-next.config.ts`、`apps/web/.env.schema`
  - 需求：R1
  - 完成标准：`pnpm -F web exec opennextjs-cloudflare build` 成功

- [ ] 2. 核对同源转发路由
  - 内容：确认路径、查询参数、请求头、`Set-Cookie` 和缓存头符合设计
  - 文件：`apps/web/src/lib/proxy-aws-api.ts`、`apps/web/src/app/trpc/[...path]/route.ts`、`apps/web/src/app/api/auth/[...path]/route.ts`
  - 需求：R2
  - 完成标准：`pnpm check-types` 通过；改动文件 ultracite 检查零报错

- [ ] 3. 本地预览验证转发错误
  - 内容：用 `pnpm -F web exec opennextjs-cloudflare preview` 分别验证未配置和不可达的 `AWS_API_ORIGIN`
  - 文件：无代码改动，结果记录到 `specs/sl-ai-admin/07-web-cloudflare-deploy/test-report.md`
  - 需求：R3
  - 完成标准：`/trpc/healthCheck` 分别返回 503 和 502

- [ ] 4. 线上发布（由用户手动执行）
  - 内容：按 `aws任务/云端部署.md` 发布，确认后端可访问，`AWS_API_ORIGIN` 已配置
  - 文件：无代码改动
  - 需求：R1、R2
  - 完成标准：线上首页和 `/login` 能打开

- [ ] 5. 线上验收
  - 内容：逐条对照 requirements.md 的 AC1–AC7 检查并勾选，走完搜索、保存、修改、删除
  - 文件：`specs/sl-ai-admin/07-web-cloudflare-deploy/test-report.md`
  - 需求：R1、R2、R3、R4
  - 完成标准：所有 AC 通过，待确认问题已关闭或已记录
