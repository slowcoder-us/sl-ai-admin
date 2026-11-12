# Web 部署到 Cloudflare - 需求

> 来源：`docs/首页需求.md` · 1 背景与目标、2.7 部署
> 依赖：04-github-profile-search、05-github-profile-save、06-github-profile-edit-delete

## 背景

Web（app-view 模块，`apps/web`）需要部署到 Cloudflare，线上用户才能使用 GitHub 用户管理。浏览器只访问 Web 自身的域名，登录 Cookie 和页面拦截都在同一个域名下工作。

## 用户故事

- 作为登录用户，我希望通过线上地址完成搜索、保存、修改和删除，以便不依赖本地环境。

## 需求条目

| 编号 | 需求 | 优先级 |
|------|------|--------|
| R1 | Web 能构建并发布到 Cloudflare Workers | P0 |
| R2 | `/trpc/*` 和 `/api/auth/*` 由 Web 转发到后端服务 | P0 |
| R3 | 后端地址未配置或不可达时返回明确的错误状态码 | P1 |
| R4 | 线上可以完成登录以及搜索、保存、修改、删除 | P0 |

### R1 发布

用 OpenNext 构建 `apps/web`，发布为 Cloudflare Worker `sl-ai-admin-web`。

### R2 同源转发

浏览器的 tRPC 和登录请求都发到 Web 域名，由 Web 转发到 `AWS_API_ORIGIN`，保留路径和查询参数，并原样带回 `Set-Cookie`。转发响应不缓存。

### R3 转发错误

`AWS_API_ORIGIN` 未配置时返回 503；后端不可达时返回 502。

### R4 线上全流程

在线上地址完成 `docs/首页需求.md` 2.1–2.5 的全部操作。

## 验收标准

- [ ] AC1（R1）：`pnpm -F web exec opennextjs-cloudflare build` 成功。
- [ ] AC2（R1）：发布后，线上首页和 `/login` 能打开。
- [ ] AC3（R2）：线上登录成功，浏览器网络面板中 `/api/auth/*` 和 `/trpc/*` 都请求 Web 自身域名，登录后访问 `/dashboard` 不会跳回登录页。
- [ ] AC4（R2）：转发响应头包含 `cache-control: private, no-store`。
- [ ] AC5（R3）：本地预览未配置 `AWS_API_ORIGIN` 时，`/trpc/healthCheck` 返回 503。
- [ ] AC6（R3）：本地预览把 `AWS_API_ORIGIN` 指向不可达的地址时，`/trpc/healthCheck` 返回 502。
- [ ] AC7（R4）：线上用测试账号依次搜索 `octocat`、保存、修改姓名、删除，每一步结果正确。

## 不在范围内

- 后端部署到 AWS Lambda、VPC、Aurora、跳板机、GitHub Actions 流水线本身（见 `aws任务/云端部署.md`）
- 自定义域名

## 待确认问题

- 本 feature 的线上验收要求后端已部署且可访问，并且 `AWS_API_ORIGIN` 已配置。
