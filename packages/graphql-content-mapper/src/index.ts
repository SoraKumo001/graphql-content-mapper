import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { parse, type DocumentNode, type OperationDefinitionNode } from "graphql";
import { resolveConfig, type MapperConfig } from "./config.js";

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

// Mute stdout during any library logs so JSON-RPC framing is not corrupted
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

function deduplicateDeclarations(content: string): string {
  const lines = content.split("\n");
  const seen = new Set<string>();
  const cleaned: string[] = [];
  let skipping = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!skipping) {
      const match = line.match(/^export (?:type|enum)\s+(\w+)/);
      if (match) {
        const name = match[1];
        if (seen.has(name)) {
          skipping = true;
          braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          if (braceCount === 0 && line.trim().endsWith(";")) {
            skipping = false;
          }
          continue;
        } else {
          seen.add(name);
        }
      }
      cleaned.push(line);
    } else {
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceCount === 0 && line.trim().endsWith(";")) {
        skipping = false;
      }
    }
  }
  return cleaned.join("\n");
}

// Lazy-load @graphql-codegen/cli so initialize responds instantly (<10ms)
let cachedExecuteCodegen: ((options: any) => Promise<any>) | null = null;
async function getExecuteCodegen() {
  if (!cachedExecuteCodegen) {
    const mod = await import("@graphql-codegen/cli");
    cachedExecuteCodegen = mod.executeCodegen;
  }
  return cachedExecuteCodegen;
}

const projectContextMap = new Map<unknown, ProjectContext>();

async function transformGraphQL(
  fileName: string,
  content: string,
  projectHandle: unknown
): Promise<TransformResult> {
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
    const doc: DocumentNode = parse(content);
    const executeCodegen = await getExecuteCodegen();

    const codegenConfig: Record<string, any> = {
      scalars: config.scalars,
      skipTypename: config.skipTypename ?? false,
      ...(config.enumsAsTypes !== undefined && { enumsAsTypes: config.enumsAsTypes }),
      ...(config.futureProofEnums !== undefined && { futureProofEnums: config.futureProofEnums }),
      ...config.codegenConfig,
    };

    const codegenResult = await executeCodegen({
      schema: schemaPath,
      documents: fileName,
      generates: {
        "virtual.ts": {
          plugins: ["typescript", "typescript-operations"],
          config: codegenConfig,
        },
      },
    });

    const rawGenerated = codegenResult?.result?.[0]?.content || "";
    const cleanGenerated = deduplicateDeclarations(rawGenerated);

    const operations = doc.definitions
      .filter((d): d is OperationDefinitionNode => d.kind === "OperationDefinition" && !!d.name)
      .map((d) => ({
        name: d.name!.value,
        op: d.operation.charAt(0).toUpperCase() + d.operation.slice(1),
      }));

    const docTypeDefinitions = `
import type { DocumentNode } from "graphql";

export interface TypedDocumentNode<
  Result = { [key: string]: any },
  Variables = { [key: string]: any },
> extends DocumentNode {
  /**
   * Type signature used for inference
   */
  __apiType?: (variables: Variables) => Result;
}
`;

    const docExports = operations
      .map((o) => {
        const varType = o.name + o.op + "Variables";
        const resType = o.name + o.op;
        return `export declare const ${o.name}: TypedDocumentNode<${resType}, ${varType}>;`;
      })
      .join("\n");

    const fullText = [docTypeDefinitions, cleanGenerated, docExports].join("\n\n");

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

async function handleMessage(msg: JsonRpcRequest): Promise<void> {
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
        result = await transformGraphQL(
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
