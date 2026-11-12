# GitHub 用户搜索（Web） - 需求

> 来源：`docs/首页需求.md` · 2.1 搜索 GitHub 用户、2.6 访问控制、3 页面、4 交互要求
> 依赖：02-web-access-control

## 背景

登录用户需要在后台按 GitHub 用户名查到对方的公开资料，这是后续保存、修改、删除的入口。本 feature 提供 Web 页面、入口和查询接口。

## 用户故事

- 作为登录用户，我希望输入 GitHub 用户名就能看到对方的公开资料，以便决定是否保存。
- 作为登录用户，我希望查询失败时看到明确的原因，以便知道是输错了还是稍后再试。

## 需求条目

| 编号 | 需求 | 优先级 |
|------|------|--------|
| R1 | 后台首页提供「GitHub 用户管理」入口 | P0 |
| R2 | GitHub 用户管理页和查询接口需要登录 | P0 |
| R3 | 校验 GitHub 用户名格式，不合法时显示中文提示 | P0 |
| R4 | 查询并显示 GitHub 公开资料 | P0 |
| R5 | 查询失败时按原因显示提示 | P0 |
| R6 | 查询过程显示加载状态并防止重复提交 | P1 |

### R1 后台首页入口

`/dashboard` 显示「GitHub 用户管理」链接，点击进入 `/dashboard/github-users`。

### R2 访问控制

- 未登录访问 `/dashboard/github-users` 时跳转到 `/login`。
- `githubProfiles.lookup` 在未登录时返回 401（UNAUTHORIZED）。

### R3 用户名校验

- 用户名必填，首尾空格忽略，最长 39 位。
- 只能包含字母、数字和连字符；连字符不能在开头、结尾，也不能连续出现。
- 不合法时显示「请输入有效的 GitHub 用户名」，不发起查询。
- 校验规则放在一处，Web、移动端和接口共用。

### R4 显示资料

查询成功后显示头像、用户名、姓名、简介、所在地。资料中没有的项不显示。用户名链接在新标签页打开该用户的 GitHub 主页。

### R5 失败提示

| 场景 | 提示 |
|------|------|
| GitHub 返回 404 | 找不到该 GitHub 用户 |
| GitHub 返回 403 或 429 | GitHub 查询暂时受限，请稍后重试 |
| 网络失败、超时、其他状态码或返回内容不合法 | 暂时无法读取 GitHub 资料，请稍后重试 |

提示显示在搜索区内，同一个错误只显示一次。

### R6 加载状态

查询进行中显示「正在搜索…」，搜索按钮禁用。

## 非功能需求

- 调用 GitHub 的超时时间为 5 秒。
- 头像只接受 `https://avatars.githubusercontent.com` 来源，其他来源按没有头像处理。

## 验收标准

- [x] AC1（R1）：已登录用户打开 `/dashboard`，点击「GitHub 用户管理」，进入 `/dashboard/github-users`。
- [x] AC2（R2）：未登录访问 `/dashboard/github-users`，跳转到 `/login`。
- [x] AC3（R2）：未登录调用 `githubProfiles.lookup`，返回 401。
- [x] AC4（R3）：输入 `-abc`、`a--b` 或 40 位字符并提交，搜索区显示一次「请输入有效的 GitHub 用户名」，不出现 JSON 文本，也不发起查询。
- [x] AC5（R4）：输入 `octocat` 并搜索，显示头像、`@octocat`、姓名；点击用户名在新标签页打开 `https://github.com/octocat`。
- [x] AC6（R4）：GitHub 资料的姓名、简介、所在地为空时，对应项不显示。
- [x] AC7（R5）：GitHub 分别返回 404、403、429、500、超时、非法内容时，接口返回 R5 表中对应的提示。
- [x] AC8（R5）：页面显示查询错误时，搜索区内只出现一次提示，没有重复的 toast。
- [x] AC9（R6）：查询进行中显示「正在搜索…」且搜索按钮禁用。

## 不在范围内

- 保存和已保存列表：05-github-profile-save
- 修改和删除：06-github-profile-edit-delete
- 移动端页面：08-native-github-profiles
- 模糊搜索

## 待确认问题

无（2026-11-07 确认：独立页面 `/dashboard/github-users` 加首页入口）
