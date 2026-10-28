# next-graphql

A modern full-stack GraphQL application demonstrating the power of TypeScript 7.1 **Content Mappers**, eliminating the need for static file pre-generation via `graphql-codegen`.

---

## 🌟 Key Features

- **Direct `.graphql` File Imports**:
  - Directly import query documents (`TypedDocumentNode`) and schema Enums from `graphql/query.graphql`.
  - No static generated files (`src/generated/graphql.ts`, etc.) or background watch processes needed.
- **Custom TypeScript 7.1 Content Mapper**:
  - Implemented as a JSON-RPC 2.0 stdio server in `packages/graphql-content-mapper`.
  - Dynamically synthesizes virtual TypeScript definitions in memory during compilation.
- **Next.js 16 (App Router + Turbopack / Webpack) Support**:
  - Custom loaders enable `.graphql` files to be loaded directly as runtime modules in both Turbopack and Webpack.
- **Full-Stack Type Safety**:
  - **Server**: Code-first GraphQL schema with Pothos GraphQL, Prisma, and GraphQL Yoga.
  - **Client**: Fully inferred queries and mutations via Urql (`useQuery`, `useMutation`).

---

## 🛠 Tech Stack

| Category | Technology / Library |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) / React 19 |
| **Language** | TypeScript 7.1.0-beta (Content Mappers, Native Engine) |
| **GraphQL Server** | GraphQL Yoga 5, Pothos GraphQL 4 |
| **Database / ORM** | PostgreSQL, Prisma 7 |
| **GraphQL Client** | Urql 5, `@graphql-typed-document-node/core` |
| **CSS / Styling** | Tailwind CSS 4 |
| **Package Manager** | pnpm |

---

## 📁 Directory Structure

```
next-graphql/
├── graphql/
│   ├── schema.graphql              # Exported server GraphQL schema
│   └── query.graphql               # Client GraphQL operation definitions
├── packages/
│   └── graphql-content-mapper/     # TypeScript 7.1 Content Mapper
│       ├── src/
│       │   ├── index.ts            # JSON-RPC 2.0 stdio handler (type resolution)
│       │   └── loader.ts           # Next.js runtime loader (with Enum extraction)
│       ├── package.json            # contentMapper manifest
│       └── tsconfig.json
├── prisma/
│   ├── schema.prisma               # Prisma data models
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── Home.tsx                # Component directly importing and executing query.graphql
│   │   ├── category/page.tsx       # Category management component
│   │   ├── explorer/               # Apollo Explorer playground
│   │   ├── graphql/route.ts        # GraphQL Yoga route handler (/graphql)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── client.ts               # Urql client setup
│   │   ├── prisma.ts               # Prisma client singleton
│   │   └── schema.ts               # Pothos GraphQL schema definitions
│   └── generated/
│       └── pothos-types.ts         # Generated Pothos Prisma types
├── docker/
│   └── docker-compose.yml          # PostgreSQL development container
├── next.config.js                  # Turbopack / Webpack loader configuration
├── tsconfig.json                   # contentMappers configuration
└── package.json
```

---

## 💡 Architecture & How It Works

### 1. Type Resolution with TypeScript 7.1 Content Mappers

```
[Client Code (Home.tsx)]
       │ import { BooksDocument, OrderBy } from "../../graphql/query.graphql";
       ▼
[tsc / Language Server] (TypeScript 7.1)
       │ Detects unknown extension .graphql
       │ Sends transform request over JSON-RPC 2.0 (stdio)
       ▼
[packages/graphql-content-mapper]
       │ 1. Parses query.graphql AST
       │ 2. Synthesizes types in memory based on schema.graphql
       │ 3. Generates TypedDocumentNode & Enum exports
       ▼
[tsc / Language Server]
       └ Performs type checking and autocomplete with virtual definitions
         (No physical intermediate files written to disk)
```

### 2. Runtime Bundler Integration (Next.js / Vite / Webpack)

At bundle and runtime, custom adapters provide the query AST and Enums as native ES Modules (`export const ...`):

1. The GraphQL AST parser extracts required operations and referenced fragments into `DocumentNode` objects.
2. Enum definitions from `schema.graphql` (e.g. `OrderBy: { Asc: "Asc", Desc: "Desc" }`) are extracted and exported as named constants.
3. **Next.js (Turbopack / Webpack)**: `withGraphQLContentMapper` or custom loader rules load `.graphql` files directly.
4. **Vite**: `graphql-content-mapper/vite` plugin provides native ESM support and HMR (including schema change watching).

---

## 🚀 Client Usage Example

Directly import queries and enums from `.graphql` files:

```tsx
// src/app/Home.tsx
"use client";

import { useMutation, useQuery } from "urql";
import {
  BooksDocument,
  CategoriesDocument,
  CreateBookDocument,
  DeleteBookDocument,
  OrderBy,
  UpdateBookDocument,
} from "../../graphql/query.graphql";

export default function Home() {
  // BooksDocument resolves as a TypedDocumentNode,
  // automatically inferring data and variables types
  const [{ data, fetching }] = useQuery({
    query: BooksDocument,
    variables: {
      order: OrderBy.Asc,
    },
  });

  const [, createBook] = useMutation(CreateBookDocument);

  // ...
}
```

---

## 🏁 Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL Database
```bash
pnpm run dev:docker
```

### 3. Run Prisma Migrations & Generate Client
```bash
pnpm run prisma:migrate
```

### 4. Run Type Checking
```bash
pnpm run typecheck
```
> Builds the content mapper and executes `tsc --runExternalCode --noEmit`.

### 5. Start Development Server
```bash
pnpm run dev:next
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 VS Code Configuration

TypeScript 7.1 adopts a new native binary engine (`tsc.exe`) and updated LSP architecture. To use Content Mappers in VS Code:

1. **Install the Extension**
   - Install the official Microsoft preview extension: **`TypeScript 7`** (ID: `TypeScriptTeam.native-preview`).
2. **Configure `.vscode/settings.json`**
   ```json
   {
     "js/ts.tsdk.path": "node_modules/typescript",
     "js/ts.tsdk.additionalLocations": [
       "node_modules/typescript"
     ],
     "js/ts.contentMappers.enabled": true
   }
   ```
3. **Select TypeScript Version**
   - Click **`TypeScript Language Server`** in the status bar.
   - Choose `Select Version...` -> **`Use Custom Version` (7.1.0-beta - node_modules/typescript)**.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm run dev:next` | Start Next.js dev server (Turbopack) |
| `pnpm run dev:docker` | Start PostgreSQL container via Docker Compose |
| `pnpm run build:mapper` | Compile `packages/graphql-content-mapper` |
| `pnpm run typecheck` | Build content mapper and run `tsc --runExternalCode --noEmit` |
| `pnpm run build` | Prisma generate + typecheck + Next.js production build |
| `pnpm run prisma:migrate` | Format and run Prisma migrations |
| `pnpm run prisma:generate` | Regenerate Prisma client & Pothos types |
| `pnpm run lint` | Run ESLint checks and fixes |
