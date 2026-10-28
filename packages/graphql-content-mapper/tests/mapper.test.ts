import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Buffer } from "node:buffer";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const schemaPath = path.join(FIXTURES_DIR, "schema.graphql");
const queryPath = path.join(FIXTURES_DIR, "query.graphql");
const mapperScript = path.resolve(__dirname, "../dist/index.js");

function createRpcClient(proc: ChildProcessWithoutNullStreams) {
  let buffer = Buffer.alloc(0);
  const pendingRequests = new Map<number, (res: any) => void>();

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.subarray(0, headerEnd).toString("utf-8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) break;

      const len = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + len) break;

      const body = buffer.subarray(bodyStart, bodyStart + len).toString("utf-8");
      buffer = buffer.subarray(bodyStart + len);

      try {
        const msg = JSON.parse(body);
        const resolver = pendingRequests.get(msg.id);
        if (resolver) {
          pendingRequests.delete(msg.id);
          resolver(msg);
        }
      } catch {
        // Ignore
      }
    }
  });

  let nextId = 1;
  return {
    send(method: string, params?: any): Promise<any> {
      const id = nextId++;
      return new Promise((resolve) => {
        pendingRequests.set(id, resolve);
        const json = JSON.stringify({ jsonrpc: "2.0", id, method, params });
        const len = Buffer.byteLength(json, "utf-8");
        proc.stdin.write(`Content-Length: ${len}\r\n\r\n${json}`);
      });
    },
  };
}

describe("content mapper stdio JSON-RPC", () => {
  let proc: ChildProcessWithoutNullStreams;
  let client: ReturnType<typeof createRpcClient>;

  beforeAll(() => {
    proc = spawn("node", [mapperScript]);
    client = createRpcClient(proc);
  });

  afterAll(() => {
    proc.kill();
  });

  it("should respond to initialize request immediately", async () => {
    const res = await client.send("initialize");
    expect(res.result).toEqual({
      positionEncoding: "utf-16",
      diagnosticSource: "graphql-content-mapper",
    });
  });

  it("should accept openProject with tsconfig options", async () => {
    const res = await client.send("openProject", {
      projectHandle: 1,
      configFileName: path.join(FIXTURES_DIR, "tsconfig.json"),
      options: {
        schema: schemaPath,
        scalars: { DateTime: "string" },
      },
    });
    expect(res.result).toEqual({});
  });

  it("should transform GraphQL content into TypeScript definitions (TypedDocumentNode)", async () => {
    const queryContent = fs.readFileSync(queryPath, "utf-8");
    const res = await client.send("transform", {
      projectHandle: 1,
      fileName: queryPath,
      content: queryContent,
    });

    expect(res.result).toBeDefined();
    expect(res.result.extension).toBe(".ts");

    const text: string = res.result.text;
    expect(text).toContain("export interface TypedDocumentNode");
    expect(text).toContain("export declare const GetUsers: TypedDocumentNode<GetUsersQuery, GetUsersQueryVariables>;");
    expect(text).toContain("export declare const AddUser: TypedDocumentNode<AddUserMutation, AddUserMutationVariables>;");
    expect(text).toContain("export enum UserRole");
  });
});
