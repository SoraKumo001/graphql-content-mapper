"use client";

import Link from "next/link";
import { useMutation, useQuery } from "urql";
import {
  CountPost,
  CreateOnePost,
  DeleteOnePost,
  FindManyCategory,
  FindManyPost,
  OrderBy,
} from "../../graphql/query.graphql";

const context = {
  additionalTypenames: ["Post", "Category"],
};

// 1ページに表示する投稿の数
const PageLimit = 5;

export const Home = ({ page }: { page: number }) => {
  // FindManyPostを使用して、投稿を取得する(updatedAtを降順)
  const [{ data: dataPost }] = useQuery({
    query: FindManyPost,
    variables: {
      orderBy: { updatedAt: OrderBy.Desc },
      categoriesOrderBy: { name: OrderBy.Asc },
      limit: 5,
      offset: (page - 1) * PageLimit,
    },
    context,
  });
  const [{ data: dataCategory }] = useQuery({
    query: FindManyCategory,
    variables: { orderBy: { name: OrderBy.Asc } },
  });
  // 投稿の総数を取得する
  const [{ data: dataPostCount }] = useQuery({
    query: CountPost,
    context,
  });
  // 新しい投稿を作成する
  const [{ fetching: fetchingCreatePost }, createPost] =
    useMutation(CreateOnePost);
  // 投稿を削除する
  const [, deletePost] = useMutation(DeleteOnePost);

  // 投稿フォームが送信されたときに呼び出される関数
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = (formData.get("title") as string)?.trim() || "タイトルなし";
    const content = (formData.get("content") as string)?.trim() || "内容なし";
    // カテゴリIDを取り出す (0件や1件でも安全に取得可能)
    const categories = formData.getAll("category") as string[];

    // 新しい投稿を作成する
    createPost({
      input: {
        title,
        content,
        categories: {
          connect: categories.map((id) => ({
            id,
          })),
        },
      },
    });
    // フォームをリセットする
    e.currentTarget.reset();
  };

  // 投稿の総数を取得する
  const postCounts = dataPostCount?.countPost ?? 0;
  // 投稿の総ページ数を計算する
  const postPages = Math.ceil(postCounts / PageLimit);
  return (
    <>
      <div className="max-w-2xl m-auto py-4">
        <Link className="underline text-blue-500" href="/category">
          カテゴリの追加
        </Link>
        {/* 投稿フォーム */}
        <form
          className="grid border-gray-400 border-solid"
          onSubmit={handleSubmit}
        >
          <label htmlFor="title">Title</label>
          <input id="title" className="border p-1" type="text" name="title" />
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            className="border p-2 rounded"
            rows={5}
            name="content"
          />
          {/* カテゴリ一覧 */}
          <div className="flex gap-2 flex-wrap p-2">
            {dataCategory?.findManyCategory.map((category) => (
              <label
                key={category.id}
                className="border border-blue-400 rounded p-2"
              >
                <input type="checkbox" name="category" value={category.id} />{" "}
                {category.name}
              </label>
            ))}
          </div>
          <button
            className="shadow bg-blue-500 hover:bg-blue-400 focus:shadow-outline focus:outline-none text-white font-bold py-2 px-4 rounded m-1 disabled:opacity-30 disabled:cursor-not-allowed"
            type="submit"
            disabled={fetchingCreatePost}
          >
            Create Post
          </button>
        </form>
        <hr className="m-2" />
        {/* ページネーション */}
        <div className="flex gap-2 items-center">
          <div>最大5件表示</div>
          <div>
            Page {page}/{postPages}
          </div>
          <Link
            className={`border p-1 rounded ${
              page <= 1
                ? "opacity-30 cursor-not-allowed pointer-events-none"
                : ""
            }`}
            href={`/?page=${page <= 1 ? page : page - 1}`}
          >
            ←
          </Link>
          <Link
            className={`border p-1 rounded ${
              page >= postPages
                ? "opacity-30 cursor-not-allowed pointer-events-none"
                : ""
            }`}
            href={`/?page=${page >= postPages ? page : page + 1}`}
          >
            →
          </Link>
          All:{postCounts}
        </div>

        {/* 投稿一覧 */}
        <div>
          {dataPost?.findManyPost.map((post) => (
            <div key={post.id} className="mt-5 p-1 border rounded">
              <div className="flex gap-2">
                <div className="flex-1">{post.title}</div>
                <div>[{post.id}]</div>
                <div>
                  {new Date(post.updatedAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                </div>
                <button
                  className="border p-px rounded bg-red-500 hover:bg-red-400 focus:shadow-outline focus:outline-none text-white font-bold px-px"
                  onClick={() => deletePost({ where: { id: post.id } })}
                >
                  Del
                </button>
              </div>
              <div className="whitespace-pre-wrap">{post.content}</div>
              <div className="flex flex-wrap gap-1">
                {post.categories.map((category) => (
                  <div key={category.id} className="bg-slate-100 px-1">
                    {category.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-center">
        <div>
          <Link className="underline text-blue-500" href="/explorer">
            動作確認用 Apollo Explorer
          </Link>
        </div>
        <div>
          <Link
            className="underline text-blue-500"
            href="https://github.com/SoraKumo001/next-graphql"
          >
            ソースコード
          </Link>
        </div>
      </div>
    </>
  );
};
