import * as fs from "node:fs";
import {
  parse,
  type DocumentNode,
  type DefinitionNode,
  type OperationDefinitionNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type EnumTypeDefinitionNode,
} from "graphql";
import { resolveConfig, type MapperConfig } from "./config.js";

function extractEnumsFromSchema(schemaPath: string): Record<string, Record<string, string>> {
  const enums: Record<string, Record<string, string>> = {};
  if (!fs.existsSync(schemaPath)) {
    return enums;
  }

  try {
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const schemaDoc = parse(schemaContent, { noLocation: true });

    for (const def of schemaDoc.definitions) {
      if (def.kind === "EnumTypeDefinition") {
        const enumDef = def as EnumTypeDefinitionNode;
        const enumName = enumDef.name.value;
        const values: Record<string, string> = {};
        if (enumDef.values) {
          for (const val of enumDef.values) {
            values[val.name.value] = val.name.value;
          }
        }
        enums[enumName] = values;
      }
    }
  } catch {
    // If schema parsing fails, return empty enums
  }
  return enums;
}

function findFragmentSpreads(node: any, spreads: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (node.kind === "FragmentSpread") {
    spreads.add((node as FragmentSpreadNode).name.value);
  }
  for (const key of Object.keys(node)) {
    if (key !== "loc") {
      findFragmentSpreads(node[key], spreads);
    }
  }
}

export function compileGraphQLToEsm(
  source: string,
  projectDir?: string,
  customOptions?: Partial<MapperConfig> | string
): { code: string; schemaPath: string } {
  const { schemaPath } = resolveConfig(projectDir, customOptions);
  const targetSchemaPath = schemaPath;

  const doc = parse(source, { noLocation: true });

  const operations: OperationDefinitionNode[] = [];
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const def of doc.definitions) {
    if (def.kind === "OperationDefinition") {
      operations.push(def);
    } else if (def.kind === "FragmentDefinition") {
      fragments.set(def.name.value, def);
    }
  }

  const codeBlocks: string[] = [];

  // Helper to collect all required fragments recursively
  function getRequiredFragments(root: DefinitionNode): FragmentDefinitionNode[] {
    const needed = new Set<string>();
    findFragmentSpreads(root, needed);

    const result: FragmentDefinitionNode[] = [];
    const visited = new Set<string>();
    const queue = Array.from(needed);

    while (queue.length > 0) {
      const fragName = queue.shift()!;
      if (visited.has(fragName)) continue;
      visited.add(fragName);

      const fragDef = fragments.get(fragName);
      if (fragDef) {
        result.push(fragDef);
        const subSpreads = new Set<string>();
        findFragmentSpreads(fragDef, subSpreads);
        for (const sub of subSpreads) {
          if (!visited.has(sub)) {
            queue.push(sub);
          }
        }
      }
    }
    return result;
  }

  let defaultExportName: string | undefined;

  for (const op of operations) {
    const opName = op.name?.value;
    if (!opName) continue;

    if (!defaultExportName) {
      defaultExportName = opName;
    }

    const opFragments = getRequiredFragments(op);
    const opDoc: DocumentNode = {
      kind: "Document",
      definitions: [op, ...opFragments],
    };

    codeBlocks.push(`export const ${opName} = ${JSON.stringify(opDoc)};`);
  }

  for (const [fragName, fragDef] of fragments.entries()) {
    const subFragments = getRequiredFragments(fragDef);
    const fragDoc: DocumentNode = {
      kind: "Document",
      definitions: [fragDef, ...subFragments],
    };
    codeBlocks.push(`export const ${fragName} = ${JSON.stringify(fragDoc)};`);
  }

  // Enums from schema
  const enums = extractEnumsFromSchema(targetSchemaPath);
  for (const [enumName, enumValues] of Object.entries(enums)) {
    codeBlocks.push(`export const ${enumName} = ${JSON.stringify(enumValues)};`);
  }

  if (defaultExportName) {
    codeBlocks.push(`export default ${defaultExportName};`);
  } else if (operations.length === 0 && fragments.size > 0) {
    const firstFrag = fragments.keys().next().value;
    codeBlocks.push(`export default ${firstFrag};`);
  } else {
    codeBlocks.push(`export default ${JSON.stringify(doc)};`);
  }

  return {
    code: codeBlocks.join("\n"),
    schemaPath: targetSchemaPath,
  };
}
