import { createYoga } from "graphql-yoga";
import { schema } from "./schema";
import type { NextRequest } from "next/server";

const { handleRequest } = createYoga<{
  req: NextRequest;
  params: Promise<Record<string, string | string[]>>;
}>({
  schema,
  graphqlEndpoint: "/graphql",
  fetchAPI: { Response },
});

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string | string[]>> }
) {
  return handleRequest(request, { req: request, ...ctx });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string | string[]>> }
) {
  return handleRequest(request, { req: request, ...ctx });
}
