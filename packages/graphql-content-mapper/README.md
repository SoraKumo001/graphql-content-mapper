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
  // Your Next.js config
};

module.exports = withGraphQL(nextConfig);
```

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

## 💻 Usage Example

### 1. Define GraphQL Operations

```graphql
# graphql/query.graphql
query FindBooks($order: OrderBy) {
  books(orderBy: $order) {
    id
    title
    createdAt
  }
}

mutation CreateBook($title: String!) {
  createBook(title: $title) {
    id
    title
  }
}
```

### 2. Import into TypeScript / React Components

Directly import named exports from `.graphql` files with complete type safety without generating static `.ts` files:

```tsx
import { useQuery, useMutation } from "urql"; // or @apollo/client
import {
  FindBooks,      // TypedDocumentNode<FindBooksQuery, FindBooksQueryVariables>
  CreateBook,     // TypedDocumentNode<CreateBookMutation, CreateBookMutationVariables>
  OrderBy,        // Enum (e.g. { Asc: "Asc", Desc: "Desc" })
} from "../graphql/query.graphql";

export function BookList() {
  const [{ data, fetching }] = useQuery({
    query: FindBooks,
    variables: {
      order: OrderBy.Asc, // Fully type-safe
    },
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
