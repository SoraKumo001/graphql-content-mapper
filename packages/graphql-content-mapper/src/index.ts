import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { resolveConfig, type MapperConfig } from "./config.js";
import { generateTypeScriptFromGraphQL } from "./typegen.js";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: any;
}

interface TransformResult {
  text: string;
  extension: string;
  mappings: unknown[];
}

interface ProjectContext {
  projectDir: string;
  configFileName?: string;
  options?: Partial<MapperConfig>;
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

// Mute stdout during any unexpected logs so JSON-RPC framing is not corrupted
process.stdout.write = ((chunk: any, encoding?: any, callback?: any): boolean => {
  if (typeof encoding === "function") {
    encoding();
  } else if (typeof callback === "function") {
    callback();
  }
  return true;
}) as any;

function send(response: JsonRpcResponse): void {
  const json = JSON.stringify(response);
  const len = Buffer.byteLength(json, "utf-8");
  const header = `Content-Length: ${len}\r\n\r\n`;
  originalStdoutWrite(header + json);
}

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = buffer.subarray(0, headerEnd).toString("utf-8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) {
      break;
    }

    const body = buffer.subarray(bodyStart, bodyStart + contentLength).toString("utf-8");
    buffer = buffer.subarray(bodyStart + contentLength);

    try {
      const msg: JsonRpcRequest = JSON.parse(body);
      handleMessage(msg);
    } catch {
      // Ignore parse error
    }
  }
});

const projectContextMap = new Map<unknown, ProjectContext>();

function transformGraphQL(
  fileName: string,
  content: string,
  projectHandle: unknown
): TransformResult {
  const context = projectContextMap.get(projectHandle) || { projectDir: process.cwd() };
  const { config, schemaPath } = resolveConfig(
    context.projectDir,
    context.options,
    context.configFileName
  );

  if (fileName.endsWith("schema.graphql") || path.resolve(fileName) === path.resolve(schemaPath)) {
    return {
      text: "export {};",
      extension: ".ts",
      mappings: [],
    };
  }

  if (!fs.existsSync(schemaPath)) {
    return {
      text: "export {};",
      extension: ".ts",
      mappings: [],
    };
  }

  try {
    const fullText = generateTypeScriptFromGraphQL(content, schemaPath, config);

    return {
      text: fullText,
      extension: ".ts",
      mappings: [],
    };
  } catch {
    return {
      text: "export {};",
      extension: ".ts",
      mappings: [],
    };
  }
}

function handleMessage(msg: JsonRpcRequest): void {
  if (msg.id === undefined) return;

  let result: any = null;
  switch (msg.method) {
    case "initialize":
      result = {
        positionEncoding: "utf-16",
        diagnosticSource: "graphql-content-mapper",
      };
      break;
    case "openProject":
      {
        const configPath: string | undefined = msg.params?.configFileName;
        const projectDir = configPath ? path.dirname(configPath) : process.cwd();
        projectContextMap.set(msg.params?.projectHandle, {
          projectDir,
          configFileName: configPath,
          options: msg.params?.options,
        });
        result = {};
      }
      break;
    case "transform":
      {
        result = transformGraphQL(
          msg.params?.fileName,
          msg.params?.content,
          msg.params?.projectHandle
        );
      }
      break;
    case "closeProject":
      projectContextMap.delete(msg.params?.projectHandle);
      result = null;
      break;
    default:
      result = {};
  }

  send({
    jsonrpc: "2.0",
    id: msg.id,
    result,
  });
}
