# 项目架构（sl-ai-admin）

由 [Better-T-Stack](https://better-t-stack.dev) 脚手架生成（见 `bts.jsonc`），pnpm + Turborepo 的 TypeScript 全栈 monorepo：Web（Next.js）+ 移动端（Expo）共享同一个 Hono + tRPC 后端，鉴权用 Better Auth，数据库是 PostgreSQL + Prisma。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Monorepo | pnpm workspaces（`pnpm-workspace.yaml`，依赖版本统一走 `catalog:`）+ Turborepo |
| Web 前端 | Next.js 16（App Router、`typedRoutes`、React Compiler）、React 19、Tailwind CSS v4、shadcn/ui（base-ui，`base-lyra` 风格）、next-themes、sonner |
| 移动端 | Expo SDK 58 + Expo Router、React Native 0.88、HeroUI Native、Uniwind（RN 上的 Tailwind v4）、Reanimated |
| 后端 | Hono（Node runtime，`@hono/node-server`），开发用 `tsx watch`，构建用 `tsdown` |
| API | tRPC v11 + TanStack React Query（`@trpc/tanstack-react-query`） |
| 鉴权 | Better Auth（邮箱密码 + `@better-auth/expo` 插件），Prisma adapter |
| 数据库 | PostgreSQL + Prisma 7（`prisma-client` 生成器，`@prisma/adapter-pg` 驱动适配器，多文件 schema） |
| 表单 / 校验 | TanStack Form、Zod v4 |
| 环境变量 | Varlock（`.env.schema` 声明 + 类型生成，产物为各包的 `src/env.ts`） |
| 文档站 | Fumadocs（Next.js + MDX，含 `llms.txt` 路由） |
| 代码规范 | Biome + Ultracite（见下文） |

## 目录结构

```text
sl-ai-admin/
├── apps/
│   ├── server/              # Hono API 服务（端口 3000）
│   │   └── src/
│   │       ├── index.ts         # 入口：logger、CORS、/api/auth/* → Better Auth、/trpc/* → tRPC
│   │       ├── services.ts      # 单例：db = createPrismaClient(ENV)、auth = createAuth(ENV, db)
│   │       ├── context.ts       # tRPC context：从请求头取 session，注入 { db, session }
│   │       ├── env.server.ts    # 加载 varlock 并导出 ENV
│   │       └── env.ts           # ⚠️ varlock 自动生成，勿手改
│   ├── web/                 # Next.js 管理后台（端口 3001）
│   │   └── src/
│   │       ├── app/             # 路由：/（首页）、/login、/dashboard
│   │       ├── components/      # header、providers、登录/注册表单、user-menu、主题切换
│   │       ├── lib/auth-client.ts   # better-auth/react 客户端
│   │       └── utils/trpc.ts        # tRPC client + QueryClient（全局错误 toast）
│   ├── native/              # Expo 移动端
│   │   ├── app/                 # Expo Router：(drawer)/(tabs)、modal、+not-found
│   │   ├── components/          # container、sign-in、sign-up、theme-toggle
│   │   ├── contexts/            # app-theme-context
│   │   ├── lib/auth-client.ts   # Better Auth Expo 客户端（SecureStore 存 session）
│   │   ├── utils/trpc.ts        # tRPC client，原生端手动带 Cookie 头
│   │   └── src/env.ts           # ⚠️ varlock 自动生成
│   └── fumadocs/            # 文档站（端口 4000），内容在 content/docs/*.mdx
├── packages/
│   ├── api/                 # @sl-ai-admin/api：tRPC 实例与路由
│   │   └── src/
│   │       ├── index.ts         # initTRPC、router、publicProcedure、protectedProcedure
│   │       ├── context.ts       # Context 类型 { session, db }
│   │       └── routers/index.ts # appRouter（导出 AppRouter 类型供前端使用）
│   ├── auth/                # @sl-ai-admin/auth：createAuth(env, db) 工厂 + Session 类型
│   ├── db/                  # @sl-ai-admin/db：createPrismaClient(env) 工厂 + Database 类型
│   │   ├── prisma/schema/       # schema.prisma（generator/datasource）、auth.prisma（Better Auth 生成）
│   │   ├── prisma/migrations/
│   │   ├── prisma/generated/    # Prisma Client 产物（gitignore）
│   │   └── prisma.config.ts
│   ├── ui/                  # @sl-ai-admin/ui：Web 端共享 shadcn 组件、globals.css、cn 工具
│   └── config/              # @sl-ai-admin/config：共享 tsconfig.base.json（strict、noUncheckedIndexedAccess 等）
├── .agents/skills/  .claude/skills/   # AI agent skills（两处内容相同）
├── bts.jsonc                # Better-T-Stack 元数据（`create-better-t-stack add` 用）
├── turbo.json               # 任务管线与 globalEnv
└── biome.json               # Biome / Ultracite 配置
```

## 架构要点

- **依赖方向**：`apps/*` → `packages/api` → `packages/auth` → `packages/db`。`packages/*` 不直接读环境变量，而是导出接收 env 的工厂函数（`createAuth`、`createPrismaClient`），由 `apps/server/src/services.ts` 统一注入 `ENV` 并创建单例。
- **源码直连**：内部包通过 `package.json` 的 `exports` 直接指向 `src/*.ts`，无需构建；导入形如 `@sl-ai-admin/api/routers/index`、`@sl-ai-admin/ui/components/button`。
- **端到端类型安全**：web / native 只以 `import type { AppRouter }` 引用后端路由类型，再通过 HTTP（`httpBatchLink` → `${SERVER_URL}/trpc`）调用。新增接口：在 `packages/api/src/routers/` 加 procedure 并挂到 `appRouter`，需要登录的用 `protectedProcedure`（`ctx.session` 非空）。
- **鉴权流程**：Better Auth 挂在 server 的 `/api/auth/*`。Web 用跨域 Cookie（`credentials: "include"`，cookie `sameSite=none; secure`）；Native 用 Expo 插件把 session 存在 SecureStore，请求 tRPC 时通过 `authClient.getCookie()` 手动设置 `Cookie` 头。`trustedOrigins` 包含 `CORS_ORIGIN`、`sl-ai-admin://`、`exp://`、`http://localhost:8081`。
- **数据库**：schema 拆分在 `packages/db/prisma/schema/*.prisma`。`auth.prisma` 由 `pnpm auth:generate` 生成，不要手改；业务模型放新的 `.prisma` 文件。改 schema 后执行 `pnpm db:generate`，再 `pnpm db:push`（原型）或 `pnpm db:migrate`（迁移）。
- **环境变量**：每个 app 有 `.env.schema`（类型、是否敏感、是否必填），`packages/db` 通过 `@import` 复用 server 的 `DATABASE_URL`。`pnpm install` 时 postinstall 会执行 `varlock codegen` 生成 `env.ts`；新增变量后需同步更新 `.env.schema`、`turbo.json` 的 `globalEnv`，并运行 `pnpm env:generate`。
  - server：`NODE_ENV`、`BETTER_AUTH_SECRET`（≥32 位）、`BETTER_AUTH_URL`、`CORS_ORIGIN`、`DATABASE_URL`
  - web：`NEXT_PUBLIC_SERVER_URL`；native：`EXPO_PUBLIC_SERVER_URL`
- **UI**：Web 组件用 shadcn 加到 `packages/ui`（`components.json` 的 aliases 指向 `@sl-ai-admin/ui/*`）；Native 用 HeroUI Native + Uniwind，不共用 `packages/ui`。
- **Next.js 版本注意**：`apps/web/AGENTS.md` 提示该 Next.js 版本有破坏性变更，写 Web 代码前先查 `node_modules/next/dist/docs/`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动所有应用（server :3000、web :3001、fumadocs :4000、native Expo） |
| `pnpm dev:web` / `dev:server` / `dev:native` | 单独启动某个应用 |
| `pnpm build` / `pnpm check-types` | 全量构建 / 类型检查 |
| `pnpm db:generate` / `db:push` / `db:migrate` / `db:studio` | Prisma 操作 |
| `pnpm auth:generate` | 根据 Better Auth 配置重新生成 `auth.prisma` |
| `pnpm env:generate` | 重新生成各包的 varlock 类型 `env.ts` |
| `pnpm check` / `pnpm fix` | Ultracite 检查 / 自动修复 |

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm exec ultracite fix` before committing to ensure compliance.
