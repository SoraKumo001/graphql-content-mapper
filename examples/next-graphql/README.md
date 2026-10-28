# next-graphql

TypeScript 7.1 の新機能 **Content Mappers** を活用し、`graphql-codegen` による物理ファイルの事前生成を不要にした、次世代のフルスタック GraphQL アプリケーション構成です。

---

## 🌟 主な特徴

- **`.graphql` ファイルの直接インポート**
  - `graphql/query.graphql` から直接クエリドキュメント（`TypedDocumentNode`）や Enum 定義をインポート可能。
  - 静的ファイル出力（`src/generated/graphql.ts` など）の生成・更新タスクや watch プロセスの常駐が一切不要。
- **TypeScript 7.1 Content Mappers の自作実装**
  - `packages/graphql-content-mapper` 内に JSON-RPC stdio サーバーを TypeScript で実装。
  - コンパイル時にメモリ上で GraphQL AST を解析し、仮想の TypeScript 定義を動的供給。
- **Next.js 16 (App Router + Turbopack / Webpack) 対応**
  - カスタムローダーにより、Turbopack / Webpack 双方で `.graphql` を実行時モジュールとして直接ロード。
- **フルスタック型安全**
  - **サーバー**: Pothos GraphQL + Prisma + GraphQL Yoga によるコードファーストなスキーマ構築。
  - **クライアント**: Urql による完全型推論（`useQuery`, `useMutation`）。

---

## 🛠 技術スタック

| 分類 | 技術 / ライブラリ |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) / React 19 |
| **Language** | TypeScript 7.1.0-beta (Content Mappers, Native Engine) |
| **GraphQL Server** | GraphQL Yoga 5, Pothos GraphQL 4 |
| **Database / ORM** | PostgreSQL, Prisma 7 |
| **GraphQL Client** | Urql 5, `@graphql-typed-document-node/core` |
| **CSS / Styling** | Tailwind CSS 4 |
| **Package Manager** | pnpm |

---

## 📁 ディレクトリ構成

```
next-graphql/
├── graphql/
│   ├── schema.graphql              # サーバー側からエクスポートされた GraphQL スキーマ
│   └── query.graphql               # クライアント用 GraphQL オペレーション定義
├── packages/
│   └── graphql-content-mapper/     # TypeScript 7.1 コンテンツマッパー
│       ├── src/
│       │   ├── index.ts            # JSON-RPC 2.0 stdio ハンドラー（型解決用）
│       │   └── loader.ts           # Next.js 実行時ローダー（Enum 展開対応）
│       ├── package.json            # contentMapper マニフェスト定義
│       └── tsconfig.json
├── prisma/
│   ├── schema.prisma               # Prisma データモデル定義
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── Home.tsx                # query.graphql を直接インポートして実行するコンポーネント
│   │   ├── category/page.tsx       # カテゴリ一覧・作成コンポーネント
│   │   ├── explorer/               # Apollo Explorer によるクエリ確認画面
│   │   ├── graphql/route.ts        # GraphQL Yoga エンドポイント (/graphql)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── client.ts               # Urql クライアント設定
│   │   ├── prisma.ts               # Prisma クライアントインスタンス
│   │   └── schema.ts               # Pothos による GraphQL スキーマ定義
│   └── generated/
│       └── pothos-types.ts         # Pothos Prisma 連携用型定義
├── docker/
│   └── docker-compose.yml          # PostgreSQL 開発環境
├── next.config.js                  # Turbopack / Webpack ローダー設定
├── tsconfig.json                   # contentMappers 設定
└── package.json
```

---

## 💡 アーキテクチャと仕組み

### 1. TypeScript 7.1 Content Mapper による型解決の流れ

```
[クライアントコード (Home.tsx)]
       │ import { BooksDocument, OrderBy } from "../../graphql/query.graphql";
       ▼
[tsc / Language Server] (TypeScript 7.1)
       │ 未知の拡張子 .graphql を検出
       │ JSON-RPC 2.0 (stdio) で transform 要求を送信
       ▼
[packages/graphql-content-mapper]
       │ 1. query.graphql の中身を AST 解析
       │ 2. schema.graphql を元にメモリ上で型定義を合成
       │ 3. TypedDocumentNode および Enum エクスポートを生成
       ▼
[tsc / Language Server]
       └ メモリ上で受け取った仮想の TypeScript 定義を使って型チェック・補完を実行
         (※ ディスク上に中間ファイルは一切生成されません)
```

### 2. 実行時バンドラ連携（Next.js / Vite / その他）

ブラウザ実行時には、バンドラに応じたアダプターが動作し、クエリ AST および Enum を純粋な ES Modules (`export const ...`) として提供します：

1. `graphql` の AST パーサーで各 Operation と必要な Fragment のみを抽出した DocumentNode を構築。
2. `schema.graphql` 内の Enum 定義（`OrderBy: { Asc: "Asc", Desc: "Desc" }` 等）を自動抽出し、Named Export として付与。
3. **Next.js (Turbopack / Webpack)**: `withGraphQLContentMapper` またはカスタムローダーにより、`.graphql` を直接インポート可能。
4. **Vite**: `graphql-content-mapper/vite` プラグインにより、ネイティブ ESM / HMR（スキーマ変更監視を含む）に完全対応。

#### 各環境の設定例

- **Next.js (`next.config.js`)**:
  ```js
  const withGraphQL = require("graphql-content-mapper/next");
  module.exports = withGraphQL({
    // 通常の Next.js 設定
  });
  ```

- **Vite (`vite.config.ts`)**:
  ```ts
  import { defineConfig } from "vite";
  import graphql from "graphql-content-mapper/vite";

  export default defineConfig({
    plugins: [graphql()],
  });
  ```

- **設定のカスタマイズ (`package.json`)**:
  スキーマファイルの場所やカスタムスカラーをプロジェクトルートの `package.json` で指定可能：
  ```json
  {
    "graphqlContentMapper": {
      "schema": "graphql/schema.graphql",
      "scalars": {
        "DateTime": "string"
      }
    }
  }
  ```

---

## 🚀 クライアント実装例

`graphql-codegen` の静的ファイルを介さず、`.graphql` から直接クエリと Enum を名前付きインポートして使用できます：

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
  // BooksDocument は TypedDocumentNode として解決され、
  // data や variables の型が自動推論・検証される
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

## 🏁 セットアップと起動手順

### 1. 依存関係のインストール
```bash
pnpm install
```

### 2. 開発用データベース (PostgreSQL) の起動
```bash
pnpm run dev:docker
```

### 3. Prisma マイグレーションとクライアント生成
```bash
pnpm run prisma:migrate
```

### 4. 型チェック
```bash
pnpm run typecheck
```
> `build:mapper` でコンテンツマッパーがコンパイルされた後、`tsc --runExternalCode --noEmit` で型チェックが実行されます。

### 5. 開発サーバーの起動
```bash
pnpm run dev:next
```
ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## 💻 VS Code エディタの設定

TypeScript 7.1 はネイティブバイナリ（`tsc.exe`）および LSP アーキテクチャに刷新されているため、エディタ上で Content Mapper を利用するには以下の設定を行います：

1. **拡張機能のインストール**
   - Microsoft 公式のプレビュー拡張機能 **`TypeScript 7`**（ID: `TypeScriptTeam.native-preview`）をインストールします。
2. **`.vscode/settings.json` の設定**
   ```json
   {
     "js/ts.tsdk.path": "node_modules/typescript",
     "js/ts.tsdk.additionalLocations": [
       "node_modules/typescript"
     ],
     "js/ts.contentMappers.enabled": true
   }
   ```
3. **バージョンの切り替え**
   - ステータスバーの **`TypeScript Language Server`** をクリック。
   - `Select Version...` から **`Use Custom Version` (7.1.0-beta - node_modules/typescript)** を選択します。

---

## 📜 利用可能なスクリプト一覧

| コマンド | 説明 |
| :--- | :--- |
| `pnpm run dev:next` | Next.js 開発サーバーを起動 (Turbopack) |
| `pnpm run dev:docker` | Docker Compose で PostgreSQL コンテナを起動 |
| `pnpm run build:mapper` | `packages/graphql-content-mapper` を TypeScript コンパイル |
| `pnpm run typecheck` | コンテンツマッパーをビルドし、`tsc --runExternalCode --noEmit` を実行 |
| `pnpm run build` | Prisma 生成 ＋ 型チェック ＋ Next.js 本番ビルドを実行 |
| `pnpm run prisma:migrate` | Prisma スキーマをフォーマットしマイグレーションを適用 |
| `pnpm run prisma:generate` | Prisma Client および Pothos 型定義を再生成 |
| `pnpm run lint` | ESLint によるコード検証と自動修正 |
