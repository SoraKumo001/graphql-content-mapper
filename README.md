# graphql-content-mapper Monorepo

Monorepo containing **`graphql-content-mapper`** (a zero-codegen GraphQL type and loader toolkit powered by TypeScript 7.1 Content Mappers) and a Next.js 16 full-stack example application.

---

## 📁 Repository Structure

```
graphql-content-mapper/
├── packages/
│   └── graphql-content-mapper/   # Core library (npm package)
│       ├── src/
│       │   ├── index.ts          # TypeScript 7.1 Content Mapper (JSON-RPC stdio)
│       │   ├── typegen.ts        # In-memory GraphQL AST type generator
│       │   ├── compiler.ts       # ESM AST compiler & Enum extractor
│       │   ├── config.ts         # Configuration resolver (tsconfig options, etc.)
│       │   ├── loader.ts         # Webpack / Turbopack loader
│       │   ├── next.ts           # Next.js helper (withGraphQLContentMapper)
│       │   └── vite.ts           # Vite / Rollup plugin
│       └── tests/                # Vitest unit & E2E test suites
│
└── examples/
    └── next-graphql/             # Next.js 16 (App Router + Turbopack) example app
        ├── graphql/
        │   ├── schema.graphql    # Server-side GraphQL schema
        │   └── query.graphql     # Client-side GraphQL operation definitions
        ├── prisma/               # Prisma database schema
        ├── src/                  # React 19 / Urql frontend & Yoga GraphQL server
        └── tsconfig.json         # contentMappers configuration
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build Core Library

```bash
pnpm build
```

### 3. Run Test Suite

```bash
pnpm test
```

### 4. Type Check Example App

```bash
pnpm typecheck
```

### 5. Start Development Server

```bash
pnpm dev:next
```

---

## 📜 License

MIT
