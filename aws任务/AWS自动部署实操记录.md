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

Aurora Express 是当前账号采用的数据库部署方式，不会修改本地 PostgreSQL。它使用服务管理的网络，不能把它描述为已经满足“数据库与 Lambda 位于同一用户 VPC”；此前为适配免费计划，已接受这一网络区别。Lambda 仍部署在应用 VPC 的私有子网，按已部署的路由访问 Express 网关。

## 3. 检查现有环境

1. 在 Chrome 打开 AWS 控制台，核对 Happy Path 账号。
2. 通过顶部服务搜索进入 CodeBuild。初次加载缓慢、页面短暂空白；加载完成后能看到项目页，不能把空白页直接当作免费计划限制。
3. 在 CloudFormation 核对 `SlAiAdminBackend` 为 `CREATE_COMPLETE`，保留 `CDKToolkit`。
4. 在 GitHub 打开仓库 → Settings → Secrets and variables → Actions。
5. 发现 production 环境仍指向旧 AWS 账号、旧区域 `us-east-2` 和旧 Worker 地址，先清理再启用新流水线。

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
- [ ] 新流水线代码合入 main。
- [ ] GitHub Actions 验证和后端部署成功。
- [ ] AWS API 与 Cloudflare 代理健康检查通过。

## 9. 后续日常使用

后端接口改动提交到 main 后，由 Actions 验证并部署；数据库 schema 改动需要先在本地生成并提交 Prisma migration，不能只提交 schema。前端仍由 Cloudflare Git 集成发布。查看问题时依次检查 GitHub Actions、CodeBuild 日志、CloudFormation 事件、Lambda CloudWatch 日志。

构建会消耗 AWS 抵扣额度；免费计划不代表所有构建无限免费。本次不执行升级账号操作。

## 10. 发布前验证记录

- server、db、infra 类型检查通过。
- 后端 IAM 连接与数据库引导测试 9 项通过，infra 资源与运行器约束测试 2 项通过。
- 11 个相关 TypeScript 文件的 Ultracite 检查通过，工作流 YAML 解析通过。
- 对当前生产 `SlAiAdminBackend` 执行 CDK diff，结果为 `There were no differences`；新 CI 将沿用当前已经部署成功的后端定义。
- 移除不再使用的 `packages/infra/github-oidc.yml` 模板。
