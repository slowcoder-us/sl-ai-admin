# 当前免费账号：Aurora Serverless Express 部署操作

更新日期：2026-11-12。本流程适用于 Happy Path，账号 `347076820926`，区域 `ap-southeast-2`，本机 profile 为 `happy-path`。不需要升级账号。

## 1. 本次采用的架构

```text
浏览器 → Cloudflare Worker / Next.js 同源代理
       → API Gateway HTTP API → Hono Lambda（应用私有子网）
                                  ↓ TCP 5432 + TLS + IAM
                         NAT Gateway（公网出口子网）→ IGW
                                  ↓
                         Aurora Express 托管互联网网关
                                  ↓
                         Aurora PostgreSQL Serverless

数据库管理：本机 → SSM → EC2 跳板机（私有子网）→ 同一 NAT/IGW 出口 → Aurora
后端自动发布：GitHub Actions → AWS CodeBuild 临时 Runner → CDK
前端自动发布：Cloudflare 现有 Git 集成
```

保留 Lambda、Aurora Serverless、VPC 私有应用子网、单个公网出口、跳板机和 GitHub Actions。数据库与 Lambda 同 VPC 这一项需要调整：免费模式仅支持 Express，Express 不允许关联客户 VPC，只支持 IAM 数据库认证。详见 [AWS 免费模式限制](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-free-tier.html)与 [Express 配置说明](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_GettingStartedAurora.AuroraPostgreSQL.ExpressConfig.html)。

数据库通过版本化脚本独立创建，CDK 应用堆栈引用其连接信息。当前项目使用的 CDK 没有 Express 创建参数，因此不再在应用堆栈里声明旧的 VPC 内数据库。数据库不会随着应用堆栈回滚被删除。

Express 是 Aurora 的快捷创建模式，不是另一种数据库引擎。本地 PostgreSQL 与 AWS 数据库独立：本地继续使用原来的 `DATABASE_URL` 和密码；只有云端设置 `DB_AUTH_MODE=iam` 后才启用 IAM 连接。云端首次发布会应用同一套迁移来创建表结构，不会自动上传本地数据，也不会改动本地数据库。

这里的“免费账号”指使用赠送额度的 Free Plan，并不表示所有资源零费用。当前起步容量为 0.5–4 ACU，未开启自动暂停；NAT、Aurora、跳板机及关联资源会消耗额度。免费模式还限制每个 Aurora 集群最多 1 GB 存储。

## 2. 准备本机和处理旧失败堆栈

在项目根目录执行。AWS CLI 必须支持 `--with-express-configuration`，你之前提供的新版 CLI 应先用下面命令确认。Docker Desktop 保持运行。

```sh
export AWS_PROFILE=happy-path
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export AWS_PAGER=""

aws --version
aws sts get-caller-identity --no-cli-pager
docker info
command -v jq
```

核对 Account 为 `347076820926`；若登录过期，先执行 `aws login --profile happy-path`。`jq` 用于读取 JSON，若找不到，可用 Homebrew 安装 `brew install jq`。

先查看旧业务堆栈的最新状态：

```sh
aws cloudformation describe-stacks \
  --stack-name SlAiAdminBackend \
  --query 'Stacks[0].StackStatus' --output text --no-cli-pager
```

只有仍为 `ROLLBACK_COMPLETE` 时，确认它就是前面失败的业务堆栈，再执行：

```sh
aws cloudformation delete-stack --stack-name SlAiAdminBackend
aws cloudformation wait stack-delete-complete --stack-name SlAiAdminBackend
```

若提示堆栈不存在，直接继续。若状态不同，先看 CloudFormation 的 Events，不照抄删除命令。不要删除已经成功的 `CDKToolkit`。之前清单中的保留日志和两个旧 Secret 不在这一步自动清理范围内；新版本不会复用旧数据库密码 Secret。

安装依赖并检查本地代码：

```sh
pnpm install --frozen-lockfile
DATABASE_URL=postgresql://build@localhost/build pnpm -F @sl-ai-admin/db exec prisma generate --no-hints
pnpm -F server check-types
pnpm -F @sl-ai-admin/infra check-types
pnpm -F server build
pnpm test
```

这里的 `build@localhost` 只是生成 Prisma 客户端所用的占位地址，不会连接或创建本地数据库。

## 3. 独立创建 Aurora Serverless Express

下面这一步会真正创建数据库并开始消耗额度，请先完成上面的账号核对：

```sh
bash scripts/prepare-aurora-express.sh
cat /tmp/sl-ai-admin-express.json
```

脚本会检查当前账号，并查找悉尼区名为 `sl-ai-admin-express` 的集群。不存在时创建；已存在时只接受启用互联网网关和 IAM 认证的 Aurora PostgreSQL 集群，不覆盖其他类型的数据库。

创建时使用默认管理员 `postgres`，指定 Serverless 容量 0.5–4 ACU，以及删除保护。备份采用 Express 默认的 1 天，不再配置之前失败的 7 天。Express 会自动创建 writer 实例，不要再手动创建第二个 writer。

实际 API 已返回 `InvalidParameterCombination`，说明不能在 Express 创建请求中指定 `--database-name`。当前脚本不再传该参数：集群先提供默认的 `postgres` 数据库，后端部署中的迁移 Lambda 再用管理员 IAM 身份连接它，创建 `sl_ai_admin` 业务库。以本账号实际 API 返回为准，不直接套用文档中“初始数据库名可修改”的表格描述。

脚本等待集群和 writer 可用后，把非敏感连接元数据写到 `/tmp/sl-ai-admin-express.json`。文件包含：

| 字段 | 用途 |
| --- | --- |
| `DatabaseHost` | 实际数据库连接端点，不带协议、不带端口 |
| `DatabaseResourceId` | `cluster-...` 格式的资源 ID，用于 IAM 连接授权 |
| `DatabaseAdminUser` | 管理员用户名，默认为 `postgres` |
| `DatabaseName` | 目标业务库 `sl_ai_admin`，后端迁移阶段才创建 |
| `BootstrapDatabaseName` | 默认管理库 `postgres`，首次建业务库时使用 |
| `ClusterIdentifier` | 控制台展示的集群名称 |

文件不保存密码或 IAM Token。资源 ID 不能用集群名称或 ARN 替代。如果 CLI 提示未知 Express 参数，先更新 AWS CLI，不要删掉该参数改成普通创建。若 AWS 返回账号限制或 AccessDenied，保留完整错误，先定位具体限制，不反复创建其他集群。

## 4. 部署网络、Lambda、迁移和跳板机

读取第三步的实际参数：

```sh
export DATABASE_HOST="$(jq -er '.DatabaseHost' /tmp/sl-ai-admin-express.json)"
export DATABASE_RESOURCE_ID="$(jq -er '.DatabaseResourceId' /tmp/sl-ai-admin-express.json)"
export DATABASE_ADMIN_USER="$(jq -er '.DatabaseAdminUser' /tmp/sl-ai-admin-express.json)"
export CF_WEB_ORIGIN=https://sl-ai-admin-web.dia463279.workers.dev
```

如果你现在使用别的前端地址，先改 `CF_WEB_ORIGIN`；它必须是 HTTPS 来源地址，不带路径或末尾 `/`。

先查看差异，再发布：

```sh
pnpm -F @sl-ai-admin/infra cdk diff SlAiAdminBackend \
  --parameters "WebOrigin=$CF_WEB_ORIGIN" \
  --parameters "DatabaseHost=$DATABASE_HOST" \
  --parameters "DatabaseResourceId=$DATABASE_RESOURCE_ID" \
  --parameters "DatabaseAdminUser=$DATABASE_ADMIN_USER"

pnpm -F @sl-ai-admin/infra cdk deploy SlAiAdminBackend \
  --parameters "WebOrigin=$CF_WEB_ORIGIN" \
  --parameters "DatabaseHost=$DATABASE_HOST" \
  --parameters "DatabaseResourceId=$DATABASE_RESOURCE_ID" \
  --parameters "DatabaseAdminUser=$DATABASE_ADMIN_USER" \
  --outputs-file /tmp/sl-ai-admin-aws-outputs.json
```

检查确认提示后输入 `y`。首次需要构建镜像、推送 ECR、创建 NAT/EC2/Lambda，并运行数据库迁移。通过 CloudFormation → `SlAiAdminBackend` → Events 查看进度。`synth` 或类型检查成功不代表云端部署已经成功。

迁移 Lambda 先连接默认的 `postgres` 库，检查并创建 `sl_ai_admin`；然后连接业务库执行已提交的 Prisma migrations，最后创建 `sl_ai_app`，授予 IAM 登录以及业务表读写权限。业务库已存在时直接复用，不重建或清空。业务 Lambda 仅获 `sl_ai_app` 的连接授权，不使用管理员连接。应用连接池每次新建连接都生成新 Token，并校验 TLS 证书；不会把短期 Token 固定写入长期环境变量。

发布成功后检查：

```sh
export AWS_API_ORIGIN="$(jq -er '.SlAiAdminBackend.ApiOrigin' /tmp/sl-ai-admin-aws-outputs.json)"
curl --fail "$AWS_API_ORIGIN/"
curl --fail "$AWS_API_ORIGIN/trpc/healthCheck"
```

根路径只验证 API 能响应。数据库读写、注册、登录和会话保持仍需要下一步实际验收。

## 5. 接通 Cloudflare 前端

在已有 Worker 的运行时变量中设置 `AWS_API_ORIGIN` 为第四步输出的 API Gateway 来源地址，然后重新发布对应版本的前端。代码通过 `/api/auth/*`、`/trpc/*` 同源代理转发到 AWS，浏览器使用 Cloudflare 的同源 Cookie。

若本机已经配置好 Wrangler 发布权限，也可在项目根目录执行：

```sh
DATABASE_URL=postgresql://build@localhost/build pnpm -F @sl-ai-admin/db exec prisma generate --no-hints
pnpm -F web exec opennextjs-cloudflare build
pnpm -F web exec opennextjs-cloudflare deploy -- --var "AWS_API_ORIGIN:$AWS_API_ORIGIN"
```

然后检查前端 `/login`、`/trpc/healthCheck`，实际注册一个账号，验证登录、刷新后会话、退出及 GitHub 用户查询。Cloudflare 仅显示登录页不算数据库链路验收成功。

## 6. 通过 SSM 跳板机管理数据库

后端输出中的 `BastionInstanceId` 是私有 EC2 跳板机，没有公网 SSH 入口，也不需要 SSH 私钥。

跳板机采用 `t4g.micro` 和 ARM64 Amazon Linux 2023。此前 `t4g.nano` 已被本账号以“不符合 Free Tier 规格”拒绝，不能继续使用；AWS 的[新账号免费规格清单](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html)包含 `t4g.micro`。规格符合条件仍需结合账号额度、AMI 和其他服务限制验证，不能当作整套部署已通过。

1. AWS 控制台 → EC2 → 选择对应实例 → Connect → Session Manager。等待实例显示为 SSM 在线。
2. 在跳板机终端确认 AWS CLI 和 `psql` 已安装。缺少 `psql` 时安装 Amazon Linux 2023 提供的 PostgreSQL 客户端包。
3. 在 RDS → 实际 Express 集群 → Connectivity & security，查看 PSQL 连接示例；在跳板机中按实际端点、`postgres`、`sl_ai_admin`、悉尼区域生成 IAM Token 并连接。使用跳板机角色，不在跳板机复制个人 `happy-path` 配置。
4. TLS 使用网关的 AWS 公共根信任；保持完整证书与主机名验证。不要套用旧 VPC 内 RDS 的专用 CA 文件或关闭校验。
5. 退出 `psql` 用 `\q`。维护完成后可停止 EC2；再次维护时启动。停止实例不会停止 NAT、数据库或 EBS 等资源的费用。

Token 是短期连接凭证，不要把它贴到聊天、GitHub 或日志里。跳板机角色已限定到这一个集群的管理员数据库用户；业务 Lambda 角色只限定到应用用户。

## 7. GitHub Actions + CodeBuild 自动发布

不创建被当前账号限制的 GitHub OIDC Provider。GitHub Actions 的部署 job 运行在 AWS CodeBuild 提供的临时 Runner 中，使用 CodeBuild 的 AWS 服务角色。参考 [AWS 官方 Runner 说明](https://docs.aws.amazon.com/codebuild/latest/userguide/action-runner.html)。

### 7.1 先配置 GitHub 保护和变量

仓库 → Settings → Environments → 创建 `production`，限制部署分支为 `main`。仓库套餐若支持，可增加必需人工审核者。不要允许 PR 或任意分支使用这个生产环境。

仓库 → Settings → Secrets and variables → Actions → Variables，将 `AWS_RUNNER_PROJECT` 放在仓库级。其余下列变量配置在 `production` Environment 中。本次实际操作与账号配置见 [AWS自动部署实操记录](./AWS自动部署实操记录.md)。

| 变量 | 值 |
| --- | --- |
| `AWS_RUNNER_PROJECT` | `sl-ai-admin-deploy` |
| `AWS_ACCOUNT_ID` | `347076820926` |
| `AWS_REGION` | `ap-southeast-2` |
| `DATABASE_HOST` | 第三步实际端点 |
| `DATABASE_RESOURCE_ID` | 第三步实际 `cluster-...` ID |
| `DATABASE_ADMIN_USER` | `postgres`，或第三步实际用户名 |
| `CF_WEB_ORIGIN` | 实际前端 HTTPS 来源地址 |

后端工作流不再发布 Cloudflare Worker，不需要 Cloudflare 发布 Token。不向 GitHub 上传本机 AWS 凭据、管理员 Access Key 或数据库 Token。

### 7.2 创建 GitHub App 连接

在悉尼区 AWS CodeConnections 控制台创建 GitHub 连接，完成 GitHub App 授权，只允许目标仓库 `slowcoder-us/sl-ai-admin`，确认状态为 `Available`，记录 Connection ARN。

2026-11-13 已在当前账号实际创建 `sl-ai-admin-github`，连接状态为可用。运行器另行创建并验收，连接成功不等于整条部署流水线已成功。

### 7.3 创建 CodeBuild Runner

准备 Connection ARN 和你本人 GitHub 登录用户的数字 ID。`TrustedGitHubActorId` 是实际触发发布的个人账号 ID，不是组织 ID、仓库 ID 或用户名。可通过 GitHub 的用户 API `/users/你的登录名` 查看返回的 `id`。

```sh
# 把下面两行示例值替换为你自己的实际值
export GITHUB_CONNECTION_ARN='填实际 Connection ARN'
export TRUSTED_GITHUB_ACTOR_ID='填你个人 GitHub 用户的数字 ID'

pnpm -F @sl-ai-admin/infra cdk deploy SlAiAdminRunner \
  --parameters "GitHubConnectionArn=$GITHUB_CONNECTION_ARN" \
  --parameters "TrustedGitHubActorId=$TRUSTED_GITHUB_ACTOR_ID"
```

Runner 只接收指定仓库、指定工作流名 `Verify and deploy`、指定个人触发者的排队事件，同时最多执行一个构建。角色可以承担本账号、悉尼区域的 CDK bootstrap 发布角色，具备生产发布能力，不能用于执行不受信任 PR 的代码。

首次创建 Runner 的本机登录身份需要相应 CodeBuild、CodeConnections、IAM PassRole 权限。若被账号托管策略拒绝，保留具体错误，不修改 AWS 托管角色来绕过限制。

### 7.4 合并配置并运行

先完成以上基础资源和仓库配置，再把改动合并到 `main`。本次实际提交和验收状态见实操记录。

- PR：在 GitHub 托管 Runner 上运行 CI，不运行生产部署。
- 推送或合并到 `main`：CI 通过后，在 CodeBuild 临时 Runner 发布 AWS 后端、运行迁移并检查公开代理；前端由 Cloudflare Git 集成独立发布。
- 手动重发：Actions → Verify and deploy → Run workflow → 选择 `main`。
- AWS 触发者被严格限定为上面配置的个人账号；其他人推送 `main` 时，部署 job 可能无法匹配 Runner。需要多人发布时应先设计允许名单和生产审核，不直接开放任意触发者。

保留 Cloudflare 现有 Git 自动流水线。GitHub Actions 只负责 AWS 后端，避免两个流水线同时发布同一个 Worker。

## 8. 配置位置与实际验证边界

| 文件 | 内容 |
| --- | --- |
| `scripts/prepare-aurora-express.sh` | 单独创建或复用 Express 数据库，输出连接元数据 |
| `packages/infra/src/backend-stack.ts` | VPC、NAT/IGW、Lambda、API Gateway、SSM 跳板机、IAM 连接授权 |
| `apps/server/src/database-url.ts` | 运行时刷新 IAM Token、迁移连接地址和 TLS 设置 |
| `apps/server/src/migrate.ts` | Prisma 迁移和应用数据库用户权限 |
| `apps/server/src/bootstrap-database.ts` | 通过默认管理库创建或复用业务库，不操作本地数据库 |
| `scripts/check-aurora-connection.mjs` | 验证本机到默认管理库的 TLS 和 IAM 登录，不执行 SQL、不输出 Token |
| `packages/db/src/index.ts` | Prisma / pg 连接池，可接动态密码回调 |
| `packages/infra/src/runner-stack.ts` | CodeBuild 临时 Runner 与限定的发布角色 |
| `.github/workflows/deploy.yml` | CI、主分支发布、AWS 与 Cloudflare 验收 |

本地测试只验证代码、生成模板与连接配置，不代表数据库已经创建、Token 已通过真实网关认证，或当前 Free Plan 已允许 CodeBuild Runner。首次实操按第三步开始，遇到错误保留该步完整输出再定位。

初版验证记录：89 项测试通过；后端与基础设施类型检查、后端构建、CDK 模板生成、工作流 YAML 解析和脚本语法检查通过。初版 `linux/amd64` Node.js 24 Lambda 镜像构建成功，容器内 API 根路径返回 HTTP 200，迁移删除分支正常退出。

移除 `--database-name` 并补充业务库初始化后的验证：94 项测试通过（其中 83 项复用缓存），后端类型检查和构建通过；创建脚本的新建、复用、账号不匹配三个模拟场景通过，模拟返回允许 `DatabaseName` 为空。此轮没有重新构建容器镜像，也没有执行真实数据库连接或云端创建；真实创建结果以你重新运行脚本后的 AWS 返回为准。

## 9. 本次迁移连接超时的排查结果

2026-11-12 17:31 UTC 的失败资源为 `DatabaseSchema`。实际迁移日志显示函数执行约 5014 毫秒，报错来自 `pg` 客户端的 5000 毫秒连接计时器，不是 Lambda 的 180 秒执行上限。跳板机规格修正后已创建成功，随后随业务堆栈回滚删除。

只读核对结果：Aurora 集群和 writer 均为 `available`；互联网网关、IAM 认证开启；实际 Lambda 安全组放行出站 TCP 5432；失败部署使用的模板已让迁移等待两个 NAT 出网路由创建完成。上述配置核对不能替代从 Lambda 私有子网内进行实际连通性验证。

从本机使用当前 `happy-path` 身份对同一端点进行了不执行 SQL 的连接测试：TLS 证书校验及 IAM 登录成功，数据库连接阶段约 8.45 秒，超过原来 5 秒的上限。测试没有建库、建表或修改数据。修正为：

- 管理连接等待上限 30 秒。
- Prisma 迁移 URL 显式配置 `connect_timeout=30`。
- IAM Token 放入迁移 URL 时对整个密码部分编码，避免 Token 内已有的 `%2F`、`%2B` 等签名内容在 URI 解码时被改写；运行时连接池仍直接使用原始 Token。
- 业务 IAM 连接池等待上限 20 秒；本地密码连接继续使用原来的 5 秒。
- API Lambda 执行上限 28 秒，早于 HTTP 集成默认的 29 秒截止时间，给连接后的查询留出时间。
- 数据库初始化失败时只记录阶段和耗时，不记录连接凭证。

同时核对了项目实际使用的 Prisma Schema Engine 源码：其原生连接器不支持 `sslmode=verify-full`，会回退默认模式。迁移 URL 改用它支持的 `sslmode=require&sslaccept=strict`，要求 TLS 并保持证书校验；运行时 pg 连接继续使用 `rejectUnauthorized: true`。参考 [固定到本项目引擎版本的参数解析源码](https://github.com/prisma/prisma-engines/blob/d1b3f377ca835d73fd50954a5e22128b9ebdd6b8/quaint/src/connector/postgres/url.rs)。

如需复查本机连接，在项目根目录执行：

```sh
AWS_PROFILE=happy-path AWS_REGION=ap-southeast-2 node scripts/check-aurora-connection.mjs
```

脚本校验账号，只连接默认的 `postgres` 库；使用 `aws rds generate-db-auth-token` 在子进程中生成短期 Token，不输出 Token，也不执行 SQL。`connection-ready` 和 `PASS` 表示本机登录验证成功，不代表 Lambda 私有网络的验证已完成。

本次修正通过本地连接配置回归测试、类型检查和后端构建。云端完整迁移、应用用户登录和 API 验收仍需等失败堆栈回滚完成后，用新镜像重新部署验证。不要在 `ROLLBACK_IN_PROGRESS` 时启动下一次部署，也不需要重建已有 Aurora 集群。

生成的新镜像资产哈希已与本次失败部署使用的旧哈希不同；重新运行 CDK 会构建修正后的镜像。本次未执行云端重部署，完整迁移尚未验收。
