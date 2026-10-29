# graphql-content-mapper

A zero-codegen toolkit powered by TypeScript 7.1 **Content Mappers** that allows you to directly import type-safe `TypedDocumentNode` documents and schema Enums from `.graphql` / `.gql` files.

No intermediate physical files (`src/generated/graphql.ts`, etc.) or background watch processes are required. Type resolution and runtime code transformation occur on the fly in memory during editing and bundling.

---

## ✨ Features

- **Zero Static Code Generation**:
  - No need to run or maintain background code generator tasks like `graphql-codegen`.
- **Native TypeScript 7.1 Content Mappers Compliance**:
  - Interacts directly with `tsc` and Language Server Protocols (LSP in VS Code) via JSON-RPC 2.0 (stdio) to supply virtual TypeScript definitions on demand.
- **Multi-Bundler Support**:
  - **Vite** (`graphql-content-mapper/vite`)
  - **Next.js** (Turbopack / Webpack) (`graphql-content-mapper/next`)
  - **Webpack / Other bundlers** (`graphql-content-mapper/loader`)
- **Pure ES Modules (ESM) Output**:
  - Compiles query `DocumentNode` objects and schema Enums into native ESM (`export const ...`), ensuring seamless execution in modern browsers and runtimes.
- **Flexible Configuration**:
  - Specify custom scalars (e.g. `DateTime: "string"`) and schema paths directly in `tsconfig.json` or via environment variables / configuration files.

---

## 📦 Installation

```bash
# pnpm
pnpm add -D graphql-content-mapper graphql

# npm
npm install -D graphql-content-mapper graphql

# yarn
yarn add -D graphql-content-mapper graphql
```

---

## ⚙️ Configuration

### 1. Unified Configuration in `tsconfig.json` (Recommended)

Define the schema path and custom scalars under the `contentMappers[].options` field in TypeScript 7.1. Bundlers (Next.js / Vite / Webpack) automatically read this configuration, keeping your type resolution and bundling synchronized in a single place:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler"
    // Other compilerOptions
  },
  "contentMappers": [
    {
      "package": "graphql-content-mapper",
      "extensions": [".graphql", ".gql"],
      "options": {
        "schema": "./graphql/schema.graphql",
        "scalars": {
          "DateTime": "string",
          "JSON": "Record<string, unknown>"
        },
        "skipTypename": false
      }
    }
  ],
  "include": [
    "src/**/*",
    "graphql/**/*.graphql"
  ]
}
```

> **Note**: To run type-checking from the command line, use `tsc --runExternalCode --noEmit`.

### 2. Alternative Configuration Methods (Overrides)

You can also override options individually using any of the following methods:

1. **Direct Plugin / Loader Options**:
   - **Next.js**: `withGraphQL(nextConfig, { schema: "custom/schema.graphql", scalars: { DateTime: "string" } })`
   - **Vite**: `graphql({ schema: "custom/schema.graphql", scalars: { DateTime: "string" } })`
   - **Webpack**: `{ loader: "graphql-content-mapper/loader", options: { schema: "custom/schema.graphql" } }`

2. **Environment Variable**:
   ```bash
   export GRAPHQL_SCHEMA_PATH="custom/schema.graphql"
   ```

3. **Configuration Files**:
   - `graphql-content-mapper.config.json`
   - `.graphqlrc` / `.graphqlrc.json`
   - `graphql.config.json`
   - `"graphqlContentMapper"` key in `package.json`:
     ```json
     {
       "graphqlContentMapper": {
         "schema": "custom/schema.graphql",
         "scalars": {
           "DateTime": "string"
         }
       }
     }
     ```

---

## 🚀 Bundler Integration

### Next.js (App Router / Pages Router)

Wrap your Next.js config with `graphql-content-mapper/next`. Both Turbopack and Webpack loaders will be configured automatically:

```js
// next.config.js
const withGraphQL = require("graphql-content-mapper/next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Next.js internal type checker does not pass TypeScript 7.1's '--runExternalCode' flag.
    // Run 'tsc --runExternalCode --noEmit' separately in your build script.
    ignoreBuildErrors: true,
  },
};

module.exports = withGraphQL(nextConfig);
```

> [!IMPORTANT]
> **Next.js Production Build Requirement**:
> TypeScript 7.1 requires the `--runExternalCode` flag to execute external Content Mapper processes. Because `next build`'s internal type check does not yet support this flag, it will fail with `TS18068`.
>
> To resolve this without sacrificing type safety:
> 1. Add `typescript: { ignoreBuildErrors: true }` to `next.config.js`.
> 2. Run `tsc --runExternalCode --noEmit` before `next build` in your `package.json`:
>
> ```json
> {
>   "scripts": {
>     "typecheck": "tsc --runExternalCode --noEmit",
>     "build": "npm run typecheck && next build"
>   }
> }
> ```

---

### Vite

Add the `graphql-content-mapper/vite` plugin to `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import graphql from "graphql-content-mapper/vite";

export default defineConfig({
  plugins: [
    react(),
    graphql(), // Automatically watches schema changes with HMR
  ],
});
```

You can also pass custom options directly:
```ts
graphql({ schema: "src/graphql/schema.graphql" })
```

---

### Webpack (Manual Setup)

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: "graphql-content-mapper/loader",
      },
    ],
  },
};
```

---

## 💻 Usage Examples

The generated `TypedDocumentNode` conforms to the GraphQL industry standard, making it compatible with **urql**, **Apollo Client**, **graphql-request**, **TanStack Query**, and native **fetch** without additional configuration.

### 1. Define GraphQL Operations & Fragments

```graphql
# graphql/query.graphql
fragment BookFields on Book {
  id
  title
  createdAt
}

query FindBooks($order: OrderBy) {
  books(orderBy: $order) {
    ...BookFields
  }
}

mutation CreateBook($title: String!) {
  createBook(title: $title) {
    ...BookFields
  }
}
```

### 2. Client Integrations

#### urql (React)

```tsx
import { useQuery, useMutation } from "urql";
import {
  FindBooks,      // TypedDocumentNode<FindBooksQuery, FindBooksQueryVariables>
  CreateBook,     // TypedDocumentNode<CreateBookMutation, CreateBookMutationVariables>
  OrderBy,        // Enum value and type
} from "../graphql/query.graphql";

export function BookList() {
  const [{ data, fetching }] = useQuery({
    query: FindBooks,
    variables: { order: OrderBy.Asc }, // Fully type-safe
  });

  const [, createBook] = useMutation(CreateBook);

  if (fetching) return <div>Loading...</div>;

  return (
    <ul>
      {data?.books.map((b) => (
        <li key={b.id}>{b.title}</li>
      ))}
    </ul>
  );
}
```

#### Apollo Client (`@apollo/client`)

```tsx
import { useQuery, useMutation } from "@apollo/client";
import {
  FindBooks,
  CreateBook,
  OrderBy,
} from "../graphql/query.graphql";

export function BookList() {
  const { data, loading } = useQuery(FindBooks, {
    variables: { order: OrderBy.Asc },
  });

  const [createBook] = useMutation(CreateBook);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {data?.books.map((b) => (
        <li key={b.id}>{b.title}</li>
      ))}
    </ul>
  );
}
```

#### graphql-request (Next.js Server Components / Node.js)

`graphql-request` automatically infers both query variables and response types from `TypedDocumentNode`:

```ts
import { request } from "graphql-request";
import { FindBooks, OrderBy } from "./query.graphql";

const ENDPOINT = "https://example.com/graphql";

// 'data' is strongly typed as FindBooksQuery
export async function getBooks() {
  const data = await request(ENDPOINT, FindBooks, {
    order: OrderBy.Asc,
  });

  return data.books;
}
```

#### TanStack Query (React Query) + graphql-request

```tsx
import { useQuery } from "@tanstack/react-query";
import { request } from "graphql-request";
import { FindBooks, OrderBy } from "../graphql/query.graphql";

export function useBooks() {
  return useQuery({
    queryKey: ["books", OrderBy.Asc],
    queryFn: () =>
      request("/api/graphql", FindBooks, {
        order: OrderBy.Asc,
      }),
  });
}
```

#### Native `fetch` (Next.js Server Actions / Route Handlers)

You can also import types and document AST directly without any client library:

```ts
import { print } from "graphql";
import {
  FindBooks,
  type FindBooksQuery,
  type FindBooksQueryVariables,
  OrderBy,
} from "./query.graphql";

export async function fetchBooks() {
  const variables: FindBooksQueryVariables = {
    order: OrderBy.Desc,
  };

  const response = await fetch("https://example.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: print(FindBooks),
      variables,
    }),
  });

  const { data } = (await response.json()) as { data: FindBooksQuery };
  return data.books;
}
```

---

## 🏛️ Architecture

```
[Client Code (.tsx)]
       │ import { FindBooks, OrderBy } from "./query.graphql"
       ├───► [Editor / tsc (TypeScript 7.1)]
       │         │ (JSON-RPC stdio)
       │         ▼
       │     [graphql-content-mapper (Type Resolution)]
       │         │ Synthesizes types in memory from schema.graphql & query AST
       │         └─► Returns TypedDocumentNode & Enum type definitions
       │
       └───► [Bundler (Next.js / Vite / Webpack)]
                 │ (Loader / Plugin)
                 ▼
             [graphql-content-mapper (Runtime Compilation)]
                 │ Parses AST and emits pure ESM code
                 └─► export const FindBooks = { ... };
                     export const OrderBy = { ... };
```

---

## 📄 License

MIT
