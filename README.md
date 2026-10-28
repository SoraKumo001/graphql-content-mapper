# graphql-content-mapper Monorepo

TypeScript 7.1 Content Mappers を活用した GraphQL 型・ローダーライブラリ **`graphql-content-mapper`** と、Next.js 16 サンプルアプリケーションのモノレポです。

---

## 📁 ディレクトリ構成

```
graphql-content-mapper/
├── packages/
│   └── graphql-content-mapper/   # ライブラリ本体 (npm パッケージ)
│       ├── src/
│       │   ├── index.ts          # TypeScript 7.1 Content Mapper (JSON-RPC stdio)
│       │   ├── compiler.ts       # ESM AST コンパイラ & Enum 抽出
│       │   ├── config.ts         # 設定リゾルバー (tsconfig options 等)
│       │   ├── loader.ts         # Webpack / Turbopack ローダー
│       │   ├── next.ts           # Next.js ヘルパー (withGraphQLContentMapper)
│       │   └── vite.ts           # Vite / Rollup プラグイン
│       └── tests/                # Vitest 単体 & E2E テストスイート
│
└── examples/
    └── next-graphql/             # Next.js 16 (App Router + Turbopack) サンプルアプリ
        ├── graphql/
        │   ├── schema.graphql    # サーバー側 GraphQL スキーマ
        │   └── query.graphql     # クライアント用オペレーション定義
        ├── prisma/               # データベーススキーマ
        ├── src/                  # React 19 / Urql フロントエンド & Yoga サーバー
        └── tsconfig.json         # contentMappers 設定
```

---

## 🚀 クイックスタート

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. ライブラリのビルド

```bash
pnpm build
```

### 3. ライブラリのテスト実行

```bash
pnpm test
```

### 4. サンプルアプリの型チェック

```bash
pnpm typecheck
```

### 5. サンプルアプリの開発サーバー起動

```bash
pnpm dev:next
```

---

## 📜 ライセンス

MIT
