# Cloudflare 前端部署操作

核对日期：2026-11-13。本文依据当前 Chrome 中 Cloudflare Worker 的设置与项目配置整理；本次整理只读取控制台，没有修改部署设置。

## 1. 当前部署方式

项目 Web 是 Next.js，通过 OpenNext 适配后部署到 **Cloudflare Workers**。当前使用 Cloudflare 自带的 Git 构建发布，不由 GitHub Actions 再重复发布 Worker。

```text
代码提交到 GitHub main
  → Cloudflare 拉取仓库
  → 安装依赖、生成 Prisma Client
  → OpenNext 构建 Next.js
  → Wrangler 发布 Worker
  → 浏览器访问管理后台

浏览器 /api/auth/*、/trpc/*
  → 同源 Cloudflare Worker 代理
  → AWS API Gateway
  → Lambda 后端
```

AWS 后端由另一条 GitHub Actions + CodeBuild 流水线负责，参见 [AWS 自动部署实操记录](./AWS自动部署实操记录.md)。前后端虽然连接同一 GitHub 仓库，但各自发布各自的服务。

## 2. 当前资源与访问入口

| 项目 | 当前值 |
| --- | --- |
| Cloudflare Account ID | `ac65db4ee87bd2546c46172be217115c` |
| Worker 名称 | `sl-ai-admin-web` |
| GitHub 仓库 | `slowcoder-us/sl-ai-admin` |
| 生产分支 | `main` |
| Web 地址 | `https://sl-ai-admin-web.dia463279.workers.dev` |
| AWS API 来源地址 | `https://202v2w5ixf.execute-api.ap-southeast-2.amazonaws.com` |

控制台路径：Cloudflare → Workers 和 Pages → `sl-ai-admin-web` → 生产 → 设置。

[直接打开当前 Worker 设置](https://dash.cloudflare.com/ac65db4ee87bd2546c46172be217115c/workers/services/view/sl-ai-admin-web/production/settings)。

旧文档中的 `929173...` 账号、`zpslowcoder.workers.dev` 地址以及让 GitHub Actions 使用 `CF` Secret 发布前端的方式，不是当前流程。

## 3. 首次连接 GitHub 的操作

如果在新 Cloudflare 账号复现：

1. 在 Workers 和 Pages 中选择创建 Worker／应用，选择从 Git 存储库导入。
2. 连接 GitHub，选择 `slowcoder-us/sl-ai-admin`。授权时只选择需要的仓库。
3. Worker 名称填 `sl-ai-admin-web`，并确保与 `apps/web/wrangler.jsonc` 中的 `name` 一致。
4. 填写下一节中的根目录、构建命令、部署命令和构建变量。
5. 选择生产分支 `main`，完成首次构建发布。
6. 打开部署日志，确认构建和发布都成功，再访问实际 Worker 地址验收。

当前账号已经完成连接，不需要重新导入、断开连接或重复创建同名 Worker。

## 4. 控制台中当前实际填写的构建配置

位置：Worker → 设置 → 构建。以下为本次实际读取的值。

### 根目录

```text
apps/web
```

这是 monorepo 中的 Web 应用目录，不是仓库根目录。

### 构建命令

```sh
cd ../.. && pnpm install --frozen-lockfile --prod=false && DATABASE_URL=postgresql://build@localhost/build pnpm db:generate && pnpm -F web exec opennextjs-cloudflare build
```

每部分的作用：

| 命令 | 做什么 |
| --- | --- |
| `cd ../..` | 从 `apps/web` 返回仓库根目录，处理 pnpm workspace |
| `pnpm install --frozen-lockfile --prod=false` | 按锁文件安装依赖，同时安装 OpenNext、Wrangler 等构建所需开发依赖 |
| `DATABASE_URL=... pnpm db:generate` | 用占位 URL 生成 Prisma 类型；不连接数据库，也不执行迁移 |
| `pnpm -F web exec opennextjs-cloudflare build` | 构建 Next.js，再生成 Cloudflare Worker 运行产物 |

当前不是只运行 `next build`，也不是上传一个静态 `dist` 文件夹。应用包含页面服务端逻辑和 API 代理，需要发布 OpenNext 的 Worker 产物。

### 部署命令

```sh
pnpm exec opennextjs-cloudflare deploy -- --keep-vars
```

发布构建产物到生产 Worker。部署命令从配置的 `apps/web` 根目录执行；构建命令里的 `cd ../..` 不应被理解成部署命令也要从仓库根目录运行。

`--keep-vars` 用来保留控制台配置的变量。当前控制台与代码中的 `AWS_API_ORIGIN` 相同；后续修改接口地址后，应核对新版本实际使用的运行变量，避免两处配置不一致。

### 版本命令

```sh
pnpm exec opennextjs-cloudflare upload -- --keep-vars
```

上传 Worker 版本，用于非生产版本等发布流程；它与直接将版本部署到生产的 deploy 命令不是同一个动作。

### 构建变量和其他选项

| 设置 | 当前值 |
| --- | --- |
| `NODE_VERSION` | `24` |
| `SKIP_DEPENDENCY_INSTALL` | `true` |
| 生产分支 | `main` |
| 非生产分支构建 | 已勾选 |
| 禁用构建 | 关闭，即允许自动构建 |
| 构建监视包括路径 | `*` |
| 构建缓存 | 开启 |
| 构建 API Token 名称 | `sl-ai-admin-web-build`；这里只记录名称，不记录 Token 值 |

设置 `SKIP_DEPENDENCY_INSTALL=true` 后，由上面的自定义构建命令安装依赖，避免依赖安装流程不明确。监视路径当前为 `*`，共享包或后端文件的提交也可能触发前端构建。

## 5. 项目配置文件在哪

| 文件 | 内容 |
| --- | --- |
| `apps/web/wrangler.jsonc` | Worker 名称、入口、静态资源目录、兼容配置、AWS API 来源地址 |
| `apps/web/open-next.config.ts` | OpenNext 的 Cloudflare 适配配置 |
| `apps/web/.env.schema` | Web 环境变量类型声明 |
| `apps/web/src/lib/proxy-aws-api.ts` | 同源请求转发到 AWS 的公共逻辑 |
| `apps/web/src/app/api/auth/[...path]/route.ts` | Better Auth 代理路由 |
| `apps/web/src/app/trpc/[...path]/route.ts` | tRPC 代理路由 |
| `.github/workflows/deploy.yml` | AWS 后端的验证和发布，不再负责发布 Cloudflare Worker |

当前 `wrangler.jsonc` 的关键配置：

```jsonc
{
  "name": "sl-ai-admin-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "AWS_API_ORIGIN": "https://202v2w5ixf.execute-api.ap-southeast-2.amazonaws.com"
  },
  "assets": {
    "binding": "ASSETS",
    "directory": ".open-next/assets"
  },
  "observability": {
    "enabled": true
  },
  "workers_dev": true
}
```

`main` 是 Worker 程序入口，`assets` 是静态资源，`nodejs_compat` 提供相关 Node.js 兼容能力。兼容日期是运行行为配置，不需要每次发布都改成当天日期。

## 6. AWS 接口地址是怎么替换的

生产环境的 `NEXT_PUBLIC_SERVER_URL` 留空，让浏览器请求当前 Worker 域名下的 `/api/auth/*`、`/trpc/*`。

例如：

```text
浏览器请求：
https://sl-ai-admin-web.dia463279.workers.dev/trpc/healthCheck

Worker 转发到：
https://202v2w5ixf.execute-api.ap-southeast-2.amazonaws.com/trpc/healthCheck
```

代理代码读取服务端运行变量 `AWS_API_ORIGIN`，保留请求路径和查询参数，转发必要的 Cookie、Origin 等请求头，并禁止缓存 API 响应。浏览器不需要直接请求 AWS 域名。

本次在控制台“运行时变量和密钥”中也确认 `AWS_API_ORIGIN` 为上述 AWS 地址。它与构建变量 `NODE_VERSION` 不是同一类配置。

后续更换 AWS API 地址：

1. 修改 `apps/web/wrangler.jsonc` 的 `vars.AWS_API_ORIGIN`，不要填写 Markdown 链接格式，不要附加 `/trpc` 或 `/api/auth`。
2. 提交到 main，让 Cloudflare 构建发布。
3. 在新版本的运行时配置与实际请求中确认地址已生效；当前发布命令带 `--keep-vars`，不要只看某一处文本就认定已经切换。
4. 如果前端域名也换了，还需要同步 AWS 的 `WebOrigin`／GitHub production 的 `CF_WEB_ORIGIN` 并重新部署后端；只改 Worker API 地址不足以完成域名迁移。

## 7. 后续怎么自动发布前端

1. 修改 Web 或共享包代码。
2. 按正常代码流程合并或推送到 main。
3. Cloudflare → Worker → 部署，找到对应 commit，进入构建日志。
4. 确认构建、部署成功，并确认目标版本接收生产流量。
5. 打开 `/login`，检查 `/trpc/healthCheck`；再测试已有账号登录、刷新页面、查询后台数据。

只有登录页面能打开，不代表 AWS 接口和数据库已接通。后端健康接口通过，也不能替代实际账号登录与数据查询验收。

不要再给 GitHub Actions 添加发布同一 Worker 的步骤。当前 GitHub 中旧 `CF` Secret 已删除；Cloudflare 自带构建使用自己的授权，不依赖这个 GitHub Secret。

## 8. 手动从本地发布（备用）

正常发布用 Git 自动构建。需要手动排错时，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
DATABASE_URL=postgresql://build@localhost/build pnpm db:generate
pnpm -F web exec wrangler login
pnpm -F web exec opennextjs-cloudflare build
pnpm -F web exec opennextjs-cloudflare deploy -- --keep-vars
```

登录时核对目标 Cloudflare 账号。不要把真实数据库密码或 AWS 凭据填入前端的公开环境变量。

## 9. 验收与排错

```sh
curl --fail --silent --show-error \
  https://sl-ai-admin-web.dia463279.workers.dev/login --output /dev/null

curl --fail --silent --show-error \
  https://sl-ai-admin-web.dia463279.workers.dev/trpc/healthCheck
```

健康响应应包含 `"result":{"data":"OK"}`。2026-11-13 的 AWS 自动发布运行 #11 已通过上述前端入口和代理检查；本次文档核对没有重新修改或发布 Worker。

| 现象 | 先检查什么 |
| --- | --- |
| 找不到 `.open-next/worker.js` | 是否运行 OpenNext build；根目录和 Wrangler 配置是否匹配 |
| 找不到 Prisma generated client | 构建命令中是否先执行 `pnpm db:generate` |
| 构建缺少 OpenNext／Wrangler | 是否安装开发依赖，检查 `--prod=false` 与完整安装日志 |
| API 返回 503 `API origin is unavailable` | Worker 是否配置 `AWS_API_ORIGIN` |
| API 返回 502 `API origin is unavailable` | Worker 到 AWS 的连接是否成功，AWS API 是否可访问 |
| 浏览器仍请求 localhost | 检查生产构建时的 `NEXT_PUBLIC_SERVER_URL`，更改后需要重新构建 |
| 登录失败但页面正常 | 检查 AWS 日志、数据库连接、WebOrigin、Cookie 与实际认证请求 |
| main 推送后没构建 | 检查 Git 连接、生产分支、禁用构建开关、监视路径和提交跳过规则 |

## 10. 参考资料

- [Cloudflare：Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare：Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

本文的账号、地址、命令与开关来自本次控制台和仓库核对；官方资料用于解释部署工具和配置含义。
