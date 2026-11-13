# AWS 后端自动部署实操记录

记录日期：2026-11-13（Pacific/Honolulu）。本文记录本次实际操作；未通过验收的步骤会明确标为待完成。

## 1. 本次部署目标

保留 Cloudflare 现有的 Git 前端自动部署；后端由 GitHub Actions 调用 AWS CodeBuild 临时运行器，执行 CDK 部署与 Prisma 数据库迁移。AWS 账号保持免费计划，不升级，也不向 GitHub 保存 AWS 长期 Access Key。

```text
main 分支更新
├─ Cloudflare Git 集成 → 构建并发布 Web Worker
└─ GitHub Actions → 验证代码 → CodeBuild 临时运行器
                                  ├─ 构建 Docker 镜像并上传 ECR
                                  ├─ CDK 更新 SlAiAdminBackend
                                  ├─ Lambda 执行 Prisma 迁移
                                  └─ 检查 API 与前端代理
```

## 2. 当前生产资源

| 项目 | 配置 |
| --- | --- |
| GitHub 仓库 | `slowcoder-us/sl-ai-admin` |
| 自动部署分支 | `main` |
| AWS 账号 | `347076820926` |
| AWS 区域 | `ap-southeast-2`，悉尼 |
| 后端堆栈 | `SlAiAdminBackend` |
| API | `https://202v2w5ixf.execute-api.ap-southeast-2.amazonaws.com` |
| Cloudflare 前端 | `https://sl-ai-admin-web.dia463279.workers.dev` |
| Aurora Express 集群 | `sl-ai-admin-express` |
| 数据库 | `sl_ai_admin` |
| 数据库管理用户 | `postgres` |
| 数据库资源 ID | `cluster-OIXWOSFDDFWKD4476OU23FJVCM` |
| 数据库主机 | `sl-ai-admin-express.cluster-cj0uau028bpw.ap-southeast-2.rds.amazonaws.com` |
| SSM 跳板机 | `i-06321abd2ab3120d3` |
| 应用 VPC | `vpc-0534faf632b00d32a` |
| 公共出口子网 | `subnet-0d12a5e63421cee30` |
| 私有应用子网 1 | `subnet-0b30bbd1780c91fdd` |
| 私有应用子网 2 | `subnet-0da506c0a8ab17f4b` |
| IGW | `igw-02e392bb04b035698` |
| NAT Gateway | `nat-012b27760dd673313` |

Aurora Express 是当前账号采用的数据库部署方式，不会修改本地 PostgreSQL。它使用服务管理的网络，不能把它描述为已经满足“数据库与 Lambda 位于同一用户 VPC”；此前为适配免费计划，已接受这一网络区别。Lambda 仍部署在应用 VPC 的私有子网，按已部署的路由访问 Express 网关。

## 3. 检查现有环境

1. 在 Chrome 打开 AWS 控制台，核对 Happy Path 账号。
2. 通过顶部服务搜索进入 CodeBuild。初次加载缓慢、页面短暂空白；加载完成后能看到项目页，不能把空白页直接当作免费计划限制。
3. 在 CloudFormation 核对 `SlAiAdminBackend` 为 `CREATE_COMPLETE`，保留 `CDKToolkit`。
4. 在 GitHub 打开仓库 → Settings → Secrets and variables → Actions。
5. 发现 production 环境仍指向旧 AWS 账号、旧区域 `us-east-2` 和旧 Worker 地址，先清理再启用新流水线。

### 前一阶段后端首次发布的操作顺序

以下依据前面用户提供的执行日志及本次确认的生产堆栈整理；详细可复制命令见 [AuroraExpress部署操作](./AuroraExpress部署操作.md)。

1. **准备 Mac 环境**：安装并启动 Docker Desktop（Apple Silicon），安装 AWS CLI，确认 `docker info` 同时有 Client 和 Server；登录 `happy-path` profile，用 `aws sts get-caller-identity` 核对账号。
2. **准备项目**：`pnpm install --frozen-lockfile`，生成 Prisma Client。构建时 `postgresql://build@localhost/build` 只是生成代码所需的占位 URL，不会连接或修改本地库。
3. **初始化 CDK**：在 `347076820926/ap-southeast-2` 执行 `cdk bootstrap`，创建 `CDKToolkit`。它存放后续部署用的 S3、ECR 和 CDK 角色；不是业务后端本身。
4. **创建 Aurora Express**：运行 `scripts/prepare-aurora-express.sh`，在当前免费计划可用的 Express 模式中建立 Aurora Serverless 集群，启用 IAM 数据库认证和 Express 网关，写出 `/tmp/sl-ai-admin-express.json`。Express 创建集群时不能传 `database-name`，目标库由后面的迁移 Lambda 创建。
5. **配置后端部署参数**：使用实际前端 Origin、Express Host、数据库资源 ID、管理员用户名；这些不是数据库密码。执行 `cdk diff`，再部署 `SlAiAdminBackend`。
6. **CloudFormation 建立业务资源**：应用 VPC、公共出口子网、IGW、NAT、私有应用子网和路由、Lambda 所用安全组、SSM 跳板机、API Lambda、迁移 Lambda、HTTP API Gateway 和日志。当前跳板机用 `t4g.micro`；先前 `t4g.nano` 被账号的免费计划限制拒绝。
7. **构建并发布镜像**：Docker 使用 Lambda Node.js 24 基础镜像、`linux/amd64` 平台，CDK 将构建产物发布到 bootstrap ECR。之前 ECR 500、Apple Silicon 下 amd64 构建失败是历史故障，不能把它们当作当前发布成功。
8. **引导和迁移数据库**：迁移 Lambda 等待私有子网的 NAT 出网路由就绪，先通过 IAM/TLS 连接默认 `postgres` 库，再创建 `sl_ai_admin`，执行已提交的 Prisma migrations，配置 `sl_ai_app` 应用角色与相应表权限。管理角色和应用角色分开。
9. **确认 CloudFormation 完成**：用户日志显示 `SlAiAdminBackend` 部署成功并输出本记录第 2 节的 API、数据库、跳板机信息；本次浏览器也确认它为 `CREATE_COMPLETE`。
10. **连接前端**：在 `apps/web/wrangler.jsonc` 写入 `vars.AWS_API_ORIGIN`，推到 main 触发 Cloudflare 发布。浏览器请求自己的 `/api/auth/*` 和 `/trpc/*`，由 Worker/Next.js 代理到 AWS；用户已确认前端正常访问接口。

数据库连接曾报约 5 秒超时；当前实现把 IAM 建连超时提高，并确保迁移在出网路由创建后执行。迁移命令的 IAM Token 需要 URI 编码并启用严格 TLS 校验。它们已包含在本次提交的代码里，后续应由 CI 重复使用，不要重新套用早期密码连接的模板。

## 4. 建立 AWS 与 GitHub 的连接（已完成）

浏览器操作路径：AWS → CodeBuild → 左侧 Settings／设置 → Connections／连接 → Create connection／创建连接。

1. 提供商选择 GitHub。
2. 连接名称填写 `sl-ai-admin-github`。
3. 点击连接到 GitHub，授权官方 `AWS Connector for GitHub`。
4. 返回 AWS 的 GitHub 连接设置，选择安装新应用程序。
5. GitHub 安装页选择 **Only select repositories**，只选 `slowcoder-us/sl-ai-admin`，不要选 All repositories。
6. 该官方应用申请读取 Actions、部署、环境等信息，并对所选仓库的代码、管理、提交状态、PR 和 Webhook 申请读写权限；安装前已向用户说明并获得确认。
7. GitHub 要求邮件验证码确认管理身份，由用户在浏览器中自行填写并完成验证。文档不记录验证码。
8. 返回 AWS，应用安装 ID 为 `181588875`，点击连接。
9. 页面显示“已成功创建连接”，状态“可用”。

连接 ARN：

```text
arn:aws:codeconnections:ap-southeast-2:347076820926:connection/105437a0-ae4c-46ea-b0a7-328110a9b506
```

## 5. 清理 GitHub 旧部署配置（已完成）

路径：仓库 → Settings → Environments → production。

经用户确认删除：

- `AWS_DEPLOY_ROLE_ARN`：旧账号 `381492158476` 的 OIDC 部署角色引用。
- `CLOUDFLARE_ACCOUNT_ID`：旧 Cloudflare 账号引用。
- Secret `CF`：旧 GitHub Actions 发布 Worker 所用的 Token。只删除 GitHub 保存的 Secret，没有读取它的值，也没有在 Cloudflare 撤销 Token 本身。

说明：删除 GitHub 中的角色 ARN 变量，不等于删除旧 AWS 账号中的 IAM 角色；本次没有进入旧账号删除云资源。当前 Cloudflare 自带的 Git 发布连接保留。

将 production 环境变量改为：

| 变量 | 值 |
| --- | --- |
| `AWS_ACCOUNT_ID` | `347076820926` |
| `AWS_REGION` | `ap-southeast-2` |
| `CF_WEB_ORIGIN` | `https://sl-ai-admin-web.dia463279.workers.dev` |
| `DATABASE_HOST` | 上表中的 Aurora 主机 |
| `DATABASE_RESOURCE_ID` | `cluster-OIXWOSFDDFWKD4476OU23FJVCM` |
| `DATABASE_ADMIN_USER` | `postgres` |

在仓库级 Actions Variables 中新增 `AWS_RUNNER_PROJECT=sl-ai-admin-deploy`。运行器名称用于选择执行机器，放在仓库变量中，不能只放在 production 环境变量中。

production 保留仅允许 `main` 分支部署的现有规则。

## 6. 创建 CodeBuild 临时运行器（已完成）

配置源码：`packages/infra/src/runner-stack.ts`。

1. 本地检查 infra TypeScript 类型并用 CDK 合成 `SlAiAdminRunner` 模板。
2. 核对模板中的 AWS 账号与区域为本次生产账号；不能依赖旧 default profile。CDK CLI 会给子进程设置自己的默认账号和区域，必须核对最终模板。
3. Chrome → CloudFormation → 创建堆栈 → 使用新资源（标准）。
4. 选择现有模板 → 上传模板文件，上传 CDK 生成的 `SlAiAdminRunner.template.json`。
5. 堆栈名称：`SlAiAdminRunner`。
6. 参数 `GitHubConnectionArn` 使用第 4 节的 ARN。
7. 参数 `TrustedGitHubActorId=346395988`，对应 GitHub 安装页显示的个人账号 `slowcoder-us`，不是组织 ID。
8. `BootstrapVersion` 保留 `/cdk-bootstrap/hnb659fds/version`。
9. 保留失败自动回滚和部署校验；不启用 CloudFormation 快速模式。
10. 用户已确认创建运行器及其 IAM 部署权限，勾选允许创建 IAM 资源，进入查看并创建并提交。
11. 2026-11-13 03:01:01 HST，堆栈 `SlAiAdminRunner` 达到 `CREATE_COMPLETE`；CodeBuild 项目资源也为 `CREATE_COMPLETE`。
12. 控制台曾提示模板已更改；通过只读获取 S3 模板并与本地 JSON 比较，内容完全一致，提示随后消失。

堆栈 ARN：`arn:aws:cloudformation:ap-southeast-2:347076820926:stack/SlAiAdminRunner/2c6128b0-df62-11f1-baf5-06fff2fbcd97`。

控制台自动选择的 CloudFormation 执行角色为 `CloudFormationRoleManager-ap-southeast-2-stack`；这与 CodeBuild 自己的运行角色是两回事。

运行器配置：Linux、`aws/codebuild/standard:7.0`、Small、Docker privileged mode、最多同时运行 1 个构建、构建超时 60 分钟、日志保留 14 天。只处理 `Verify and deploy` 工作流以及可信 GitHub 用户的事件。

IAM 角色只允许该 CodeBuild 项目承担，使用指定 GitHub Connection，并可承担当前账号和区域现有的 CDK deploy、file-publishing、image-publishing、lookup 角色。CDK bootstrap 的部署能力可修改账号内云资源，不能把它描述为只允许更新单个 Lambda。

## 7. 代码与流水线

核心文件：

- `.github/workflows/deploy.yml`：验证、选择 CodeBuild 运行器、CDK 后端部署和健康检查；已移除重复发布 Cloudflare Worker 的步骤。
- `packages/infra/src/runner-stack.ts`：临时运行器、IAM、GitHub Webhook 过滤条件。
- `packages/infra/src/backend-stack.ts`：后端 Lambda、网络、API、跳板机和迁移资源。
- `apps/server/src/database-url.ts`：Aurora IAM 数据库连接和 TLS。
- `apps/server/src/bootstrap-database.ts`：在 Express 初始 postgres 库中创建目标数据库。
- `apps/server/src/migrate.ts`：应用已提交的 Prisma 迁移并配置应用数据库角色。
- `apps/web/wrangler.jsonc`：前端 `AWS_API_ORIGIN` 指向 AWS API。

本次启用前必须把当前已经成功部署的后端修复一并合入 main，不能让 CI 使用 main 中旧的数据库创建方式覆盖现网。

## 8. 验收清单（待完成项不可当作成功）

- [x] GitHub Connection 状态为可用。
- [x] 清理旧 production 变量与旧 CF Secret。
- [x] 新账号、区域、数据库变量与运行器名称已保存。
- [x] infra 类型检查与运行器模板合成通过。
- [x] `SlAiAdminRunner` 为 `CREATE_COMPLETE`。
- [x] CodeBuild 项目及 Webhook 创建成功。
- [x] 新流水线代码合入 main（`04f801f`）。
- [x] GitHub Actions 验证和后端部署成功（运行 #11）。
- [x] AWS API 与 Cloudflare 代理健康检查通过。

## 9. 后续日常使用

后端接口改动提交到 main 后，由 Actions 验证并部署；数据库 schema 改动需要先在本地生成并提交 Prisma migration，不能只提交 schema。前端仍由 Cloudflare Git 集成发布。查看问题时依次检查 GitHub Actions、CodeBuild 日志、CloudFormation 事件、Lambda CloudWatch 日志。

构建会消耗 AWS 抵扣额度；免费计划不代表所有构建无限免费。本次不执行升级账号操作。

## 10. 发布前验证记录

- server、db、infra 类型检查通过。
- 后端 IAM 连接与数据库引导测试 9 项通过，infra 资源与运行器约束测试 2 项通过。
- 11 个相关 TypeScript 文件的 Ultracite 检查通过，工作流 YAML 解析通过。
- 对当前生产 `SlAiAdminBackend` 执行 CDK diff，结果为 `There were no differences`；新 CI 将沿用当前已经部署成功的后端定义。
- 移除不再使用的 `packages/infra/github-oidc.yml` 模板。

## 11. 首次真实运行记录

代码提交 `04f801ff964032d3c6f653e12596102c519abdb5` 已推送到 main，自动触发 [Verify and deploy #11](https://github.com/slowcoder-us/sl-ai-admin/actions/runs/43430524413)。此次没有手动点击 Run workflow，验证的是 push 自动触发。

执行顺序及观察结果：

1. GitHub 托管运行器启动 verify，创建独立测试 PostgreSQL，安装依赖、生成 Prisma Client、应用测试迁移，完成类型检查、CDK synth、单元测试和浏览器端到端测试；verify 用时 2 分 51 秒并成功。
2. verify 成功后，production 的 deploy 作业进入队列；CodeBuild 接收到指定用户与工作流的事件，自动启动临时 GitHub Actions 运行器。
3. CodeBuild 检出 main 的本次提交，准备 Node.js 24 与 pnpm，首次依赖安装约 1 分 12 秒，完成 Varlock 类型生成和 Prisma Client 生成。
4. 作业通过 `sts get-caller-identity` 核对 AWS 账号为 `347076820926`，并检查数据库部署参数完整。
5. 自动运行 `cdk deploy SlAiAdminBackend`，通过当前账号 CDK bootstrap 部署角色更新 CloudFormation。
6. 日志显示后端堆栈于 2026-11-13 03:10:21 HST 达到 `UPDATE_COMPLETE`，CDK 部署耗时 10.64 秒，总执行约 33.67 秒。
7. 本次业务资源与已部署版本相同，复用已有 ECR 镜像，仅更新 CDK Metadata。没有新镜像变更，因此数据库迁移自定义资源也没有重复运行；以后镜像内容变化会更新迁移资源并应用已提交迁移。
8. 直接访问 AWS API 根路径返回 `OK`；前端 `/login` 返回成功；前端 `/trpc/healthCheck` 返回的 `.result.data` 为 `OK`，JSON 校验输出 `true`。
9. 完成 pnpm 缓存保存与清理后，页面显示 deploy 为 `succeeded in 5m 25s`。verify 和 deploy 两个作业均成功，首次 push 自动部署验收通过。

前端仍由 Cloudflare 的 Git 集成发布，本次 GitHub Actions 没有调用 Cloudflare Token 或发布 Worker。

### 后续如何发布接口改动

1. 修改 `apps/server`、`packages/api`、`packages/auth` 或业务数据库代码。
2. 如果改数据库 schema，先在本地创建 migration，再提交 migration 文件；不要在生产使用 `prisma migrate dev` 或 `db push`。
3. 提交并推送到 main。PR 只执行验证，main 验证通过后自动部署。
4. 到 GitHub → Actions → Verify and deploy 查看 verify 和 deploy；只有两个作业都成功才算完成自动发布。
5. 如需重发同一版本，进入工作流 → Run workflow → 选择 main；仍需由可信 GitHub 用户触发。
6. 若未来更换 API 来源地址，同步调整 `apps/web/wrangler.jsonc` 的 `vars.AWS_API_ORIGIN`，交由 Cloudflare Git 集成发布前端；后端工作流不会替你修改 Worker 变量。

### 排错入口

- GitHub CI 失败：先读失败的具体 step，部署作业不会继续执行。
- deploy 一直排队：检查仓库级 `AWS_RUNNER_PROJECT`、CodeBuild Webhook、工作流名称、GitHub actor 数字 ID 和 production 分支规则。
- CodeBuild 下载依赖慢：新机器的首次下载会较慢，先观察日志是否持续推进；不要直接判定为 IAM 权限错误。
- CDK 发布失败：查看 CloudFormation 的第一条失败事件，再按具体资源处理。不要删除已正常运行的数据库或 CDKToolkit 来重试。
- 数据库迁移或查询失败：查看对应 Lambda 的 CloudWatch 日志，确认 Express Host、资源 ID、IAM 用户、TLS 和出网路由；不要输出数据库 IAM Token。

文档验收结果随后单独提交到 main，提交消息带 `[skip ci]`，避免仅补写记录就再触发一次 AWS 部署；这不会改变后续业务代码推送的自动发布规则。

网络核对：通过 `cloudformation list-stack-resources` 读取 `SlAiAdminBackend` 的实际资源，以上 VPC、三个子网、IGW、NAT 均为 `CREATE_COMPLETE`。这是后端首次部署时创建的应用网络，本次 `SlAiAdminRunner` 没有新增 VPC。
