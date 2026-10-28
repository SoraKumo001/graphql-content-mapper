# graphql-content-mapper

TypeScript 7.1 の新機能 **Content Mappers** を利用し、`.graphql` / `.gql` ファイルから直接 `TypedDocumentNode` や Enum を型安全にインポート可能にするツールキットです。

物理ファイル（`src/generated/graphql.ts` 等）の事前生成や watch プロセスの常駐を必要とせず、エディタ上およびビルド時にメモリ上で型解決とランタイムコードの変換を行います。

---

## ✨ 特徴

- **静的コード生成の不要化**:
  - `graphql-codegen` などの静的ファイル出力タスクを実行・常駐させる必要がありません。
- **TypeScript 7.1 Content Mappers 準拠**:
  - コンパイル時および VS Code 等の Language Server (LSP) と JSON-RPC 2.0 (stdio) で対話し、仮想の TypeScript 定義をオンデマンド供給。
- **マルチバンドラ対応**:
  - **Vite** (`graphql-content-mapper/vite`)
  - **Next.js** (Turbopack / Webpack) (`graphql-content-mapper/next`)
  - **Webpack / その他** (`graphql-content-mapper/loader`)
- **純粋な ES Modules (ESM) 出力**:
  - クエリの `DocumentNode` や `schema.graphql` 内の Enum を `export const` としてネイティブ ESM 出力するため、最新のブラウザ・バンドラでスムーズに動作。
- **柔軟な設定**:
  - スキーマパスやカスタムスカラー型（`DateTime` など）を `package.json` でカスタマイズ可能。

---

## 📦 インストール

```bash
# pnpm
pnpm add -D graphql-content-mapper graphql @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations

# npm
npm install -D graphql-content-mapper graphql @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations

# yarn
yarn add -D graphql-content-mapper graphql @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations
```

---

## ⚙️ 基本設定

### 1. `tsconfig.json` での一括設定 (推奨: パターンA)

TypeScript 7.1 の `contentMappers` の `options` にスキーマファイルパスやカスタムスカラーを定義します。
バンドラ（Next.js / Vite / Webpack）もこの設定を自動的に読み込むため、**`tsconfig.json` 1箇所に設定するだけで型解決とバンドルの双方が連携**します：

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler"
    // その他の compilerOptions
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

> **Note**: 型チェックを実行する際は `tsc --runExternalCode --noEmit` を使用します。

### 2. その他の設定方法 (個別上書き用)

`tsconfig.json` 以外にも、必要に応じて以下の方法でスキーマパスやスカラーを上書き指定できます：

1. **プラグイン / ローダーの直接オプション**:
   - **Next.js**: `withGraphQL(nextConfig, { schema: "custom/schema.graphql", scalars: { DateTime: "string" } })`
   - **Vite**: `graphql({ schema: "custom/schema.graphql", scalars: { DateTime: "string" } })`
   - **Webpack**: `{ loader: "graphql-content-mapper/loader", options: { schema: "custom/schema.graphql" } }`

2. **環境変数**:
   ```bash
   export GRAPHQL_SCHEMA_PATH="custom/schema.graphql"
   ```

3. **設定ファイル**:
   - `graphql-content-mapper.config.json`
   - `.graphqlrc` / `.graphqlrc.json`
   - `graphql.config.json`
   - `package.json` の `"graphqlContentMapper"` フィールド:
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

## 🚀 バンドラ連携

### Next.js (App Router / Pages Router)

`next.config.js` で `graphql-content-mapper/next` をラップするだけで、Turbopack と Webpack の両方のローダー設定が自動的に構成されます：

```js
// next.config.js
const withGraphQL = require("graphql-content-mapper/next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // お好みの Next.js 設定
};

module.exports = withGraphQL(nextConfig);
```

---

### Vite

`vite.config.ts` に `graphql-content-mapper/vite` プラグインを追加します：

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import graphql from "graphql-content-mapper/vite";

export default defineConfig({
  plugins: [
    react(),
    graphql(), // スキーマ変更の監視 (HMR) も自動で行われます
  ],
});
```

オプションとして直接スキーマパスを渡すことも可能です：
```ts
graphql({ schema: "src/graphql/schema.graphql" })
```

---

### Webpack (直接指定する場合)

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

## 💻 使用例

### 1. GraphQL ファイルの定義

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

### 2. TypeScript / React コンポーネントからの利用

生成ファイルを介さず、`.graphql` から直接 Named Import して使用します：

```tsx
import { useQuery, useMutation } from "urql"; // または @apollo/client 等
import {
  FindBooks,      // TypedDocumentNode<FindBooksQuery, FindBooksQueryVariables>
  CreateBook,     // TypedDocumentNode<CreateBookMutation, CreateBookMutationVariables>
  OrderBy,        // Enum (例: { Asc: "Asc", Desc: "Desc" })
} from "../graphql/query.graphql";

export function BookList() {
  const [{ data, fetching }] = useQuery({
    query: FindBooks,
    variables: {
      order: OrderBy.Asc, // 完全型安全
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

## 🏛️ アーキテクチャ

```
[クライアントコード (.tsx)]
       │ import { FindBooks, OrderBy } from "./query.graphql"
       ├───► [エディタ / tsc (TypeScript 7.1)]
       │         │ (JSON-RPC stdio)
       │         ▼
       │     [graphql-content-mapper (型解決)]
       │         │ schema.graphql と AST からメモリ上で型を合成
       │         └─► TypedDocumentNode & Enum の型情報を返却
       │
       └───► [バンドラ (Next.js / Vite / Webpack)]
                 │ (ローダー / プラグイン)
                 ▼
             [graphql-content-mapper (ランタイム変換)]
                 │ AST をパースして純粋な ESM コードを出力
                 └─► export const FindBooks = { ... };
                     export const OrderBy = { ... };
```

---

## 📄 ライセンス

MIT
