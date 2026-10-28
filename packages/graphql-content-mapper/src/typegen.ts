import * as fs from "node:fs";
import {
  parse,
  type DocumentNode,
  type TypeNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  type SelectionSetNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from "graphql";
import type { MapperConfig } from "./config.js";

const BUILTIN_SCALARS = new Set(["ID", "String", "Boolean", "Int", "Float"]);

interface ObjectLikeType {
  name: string;
  fields: Map<string, FieldDefinitionNode>;
  interfaces: string[];
}

export interface SchemaIndex {
  scalars: Set<string>;
  enums: Map<string, string[]>;
  inputs: Map<string, InputValueDefinitionNode[]>;
  objects: Map<string, ObjectLikeType>;
  interfaces: Map<string, ObjectLikeType>;
  unions: Map<string, string[]>;
  rootTypes: {
    query: string;
    mutation: string;
    subscription: string;
  };
}

interface CachedSchema {
  mtimeMs: number;
  index: SchemaIndex;
}

const schemaCache = new Map<string, CachedSchema>();

export function buildSchemaIndex(schemaContent: string): SchemaIndex {
  const doc = parse(schemaContent, { noLocation: true });

  const index: SchemaIndex = {
    scalars: new Set<string>(),
    enums: new Map<string, string[]>(),
    inputs: new Map<string, InputValueDefinitionNode[]>(),
    objects: new Map<string, ObjectLikeType>(),
    interfaces: new Map<string, ObjectLikeType>(),
    unions: new Map<string, string[]>(),
    rootTypes: {
      query: "Query",
      mutation: "Mutation",
      subscription: "Subscription",
    },
  };

  for (const def of doc.definitions) {
    switch (def.kind) {
      case "SchemaDefinition":
      case "SchemaExtension": {
        if (def.operationTypes) {
          for (const opType of def.operationTypes) {
            index.rootTypes[opType.operation] = opType.type.name.value;
          }
        }
        break;
      }
      case "ScalarTypeDefinition":
      case "ScalarTypeExtension": {
        index.scalars.add(def.name.value);
        break;
      }
      case "EnumTypeDefinition":
      case "EnumTypeExtension": {
        const existing = index.enums.get(def.name.value) || [];
        if (def.values) {
          for (const val of def.values) {
            if (!existing.includes(val.name.value)) {
              existing.push(val.name.value);
            }
          }
        }
        index.enums.set(def.name.value, existing);
        break;
      }
      case "InputObjectTypeDefinition":
      case "InputObjectTypeExtension": {
        const existing = index.inputs.get(def.name.value) || [];
        if (def.fields) {
          existing.push(...def.fields);
        }
        index.inputs.set(def.name.value, existing);
        break;
      }
      case "ObjectTypeDefinition":
      case "ObjectTypeExtension": {
        const existing = index.objects.get(def.name.value) || {
          name: def.name.value,
          fields: new Map<string, FieldDefinitionNode>(),
          interfaces: [],
        };
        if (def.fields) {
          for (const f of def.fields) {
            existing.fields.set(f.name.value, f);
          }
        }
        if (def.interfaces) {
          for (const iface of def.interfaces) {
            if (!existing.interfaces.includes(iface.name.value)) {
              existing.interfaces.push(iface.name.value);
            }
          }
        }
        index.objects.set(def.name.value, existing);
        break;
      }
      case "InterfaceTypeDefinition":
      case "InterfaceTypeExtension": {
        const existing = index.interfaces.get(def.name.value) || {
          name: def.name.value,
          fields: new Map<string, FieldDefinitionNode>(),
          interfaces: [],
        };
        if (def.fields) {
          for (const f of def.fields) {
            existing.fields.set(f.name.value, f);
          }
        }
        if (def.interfaces) {
          for (const iface of def.interfaces) {
            if (!existing.interfaces.includes(iface.name.value)) {
              existing.interfaces.push(iface.name.value);
            }
          }
        }
        index.interfaces.set(def.name.value, existing);
        break;
      }
      case "UnionTypeDefinition":
      case "UnionTypeExtension": {
        const existing = index.unions.get(def.name.value) || [];
        if (def.types) {
          for (const t of def.types) {
            if (!existing.includes(t.name.value)) {
              existing.push(t.name.value);
            }
          }
        }
        index.unions.set(def.name.value, existing);
        break;
      }
    }
  }

  return index;
}

export function getSchemaIndex(schemaPath: string): SchemaIndex {
  const stat = fs.statSync(schemaPath);
  const cached = schemaCache.get(schemaPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.index;
  }
  const content = fs.readFileSync(schemaPath, "utf-8");
  const index = buildSchemaIndex(content);
  schemaCache.set(schemaPath, { mtimeMs: stat.mtimeMs, index });
  return index;
}

function capitalize(str: string): string {
  return str.length > 0 ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function isScalar(name: string, schemaIndex: SchemaIndex): boolean {
  return BUILTIN_SCALARS.has(name) || schemaIndex.scalars.has(name);
}

function resolveInputTypeNode(
  typeNode: TypeNode,
  schemaIndex: SchemaIndex,
  allowSingleItemForList: boolean
): string {
  if (typeNode.kind === "NonNullType") {
    return resolveInputTypeNode(typeNode.type, schemaIndex, allowSingleItemForList);
  }
  if (typeNode.kind === "ListType") {
    const inner =
      typeNode.type.kind === "NonNullType"
        ? resolveInputTypeNode(typeNode.type.type, schemaIndex, false)
        : `InputMaybe<${resolveInputTypeNode(typeNode.type, schemaIndex, false)}>`;
    return allowSingleItemForList ? `Array<${inner}> | ${inner}` : `Array<${inner}>`;
  }
  const name = typeNode.name.value;
  if (isScalar(name, schemaIndex)) {
    return `Scalars["${name}"]["input"]`;
  }
  return name;
}

function doesConcreteTypeMatchCondition(
  concreteTypeName: string,
  conditionTypeName: string,
  schemaIndex: SchemaIndex
): boolean {
  if (concreteTypeName === conditionTypeName) return true;
  const obj = schemaIndex.objects.get(concreteTypeName);
  if (obj && obj.interfaces.includes(conditionTypeName)) return true;
  const unionMembers = schemaIndex.unions.get(conditionTypeName);
  if (unionMembers && unionMembers.includes(concreteTypeName)) return true;
  return false;
}

function getPossibleConcreteTypes(typeName: string, schemaIndex: SchemaIndex): string[] {
  if (schemaIndex.objects.has(typeName)) {
    return [typeName];
  }
  if (schemaIndex.unions.has(typeName)) {
    return schemaIndex.unions.get(typeName) || [];
  }
  if (schemaIndex.interfaces.has(typeName)) {
    const implementers: string[] = [];
    for (const [objName, obj] of schemaIndex.objects.entries()) {
      if (obj.interfaces.includes(typeName)) {
        implementers.push(objName);
      }
    }
    return implementers;
  }
  return [];
}

function collectFieldsForType(
  selectionSet: SelectionSetNode,
  targetTypeName: string,
  schemaIndex: SchemaIndex,
  fragmentsMap: Map<string, FragmentDefinitionNode>,
  config: MapperConfig,
  visitedFragments: Set<string>,
  outFields: Map<string, string>,
  hasExplicitTypename: { value: boolean }
): void {
  const targetType =
    schemaIndex.objects.get(targetTypeName) || schemaIndex.interfaces.get(targetTypeName);

  for (const selection of selectionSet.selections) {
    if (selection.kind === "Field") {
      const responseKey = selection.alias?.value ?? selection.name.value;
      const fieldName = selection.name.value;

      if (fieldName === "__typename") {
        hasExplicitTypename.value = true;
        outFields.set(responseKey, `"${targetTypeName}"`);
        continue;
      }

      const fieldDef = targetType?.fields.get(fieldName);
      if (!fieldDef) {
        outFields.set(responseKey, "any");
        continue;
      }

      const fieldTsType = resolveOutputTypeNode(
        fieldDef.type,
        selection.selectionSet,
        schemaIndex,
        fragmentsMap,
        config
      );
      outFields.set(responseKey, fieldTsType);
    } else if (selection.kind === "FragmentSpread") {
      const fragName = selection.name.value;
      if (visitedFragments.has(fragName)) continue;
      const frag = fragmentsMap.get(fragName);
      if (!frag) continue;

      const condName = frag.typeCondition.name.value;
      if (
        doesConcreteTypeMatchCondition(targetTypeName, condName, schemaIndex) ||
        targetTypeName === condName
      ) {
        const nextVisited = new Set(visitedFragments);
        nextVisited.add(fragName);
        collectFieldsForType(
          frag.selectionSet,
          targetTypeName,
          schemaIndex,
          fragmentsMap,
          config,
          nextVisited,
          outFields,
          hasExplicitTypename
        );
      }
    } else if (selection.kind === "InlineFragment") {
      const condName = selection.typeCondition?.name.value;
      if (
        !condName ||
        doesConcreteTypeMatchCondition(targetTypeName, condName, schemaIndex) ||
        targetTypeName === condName
      ) {
        collectFieldsForType(
          selection.selectionSet,
          targetTypeName,
          schemaIndex,
          fragmentsMap,
          config,
          visitedFragments,
          outFields,
          hasExplicitTypename
        );
      }
    }
  }
}

function buildObjectShapeForType(
  selectionSet: SelectionSetNode,
  targetTypeName: string,
  schemaIndex: SchemaIndex,
  fragmentsMap: Map<string, FragmentDefinitionNode>,
  config: MapperConfig
): string {
  const fields = new Map<string, string>();
  const hasExplicitTypename = { value: false };

  collectFieldsForType(
    selectionSet,
    targetTypeName,
    schemaIndex,
    fragmentsMap,
    config,
    new Set(),
    fields,
    hasExplicitTypename
  );

  const lines: string[] = [];
  if (!config.skipTypename && !hasExplicitTypename.value) {
    lines.push(`__typename?: "${targetTypeName}";`);
  }
  for (const [key, tsType] of fields.entries()) {
    lines.push(`${key}: ${tsType};`);
  }

  if (lines.length === 0) {
    return "Record<string, never>";
  }
  return `{ ${lines.join(" ")} }`;
}

function resolveSelectionSet(
  selectionSet: SelectionSetNode,
  parentTypeName: string,
  schemaIndex: SchemaIndex,
  fragmentsMap: Map<string, FragmentDefinitionNode>,
  config: MapperConfig
): string {
  const concreteTypes = getPossibleConcreteTypes(parentTypeName, schemaIndex);
  if (concreteTypes.length === 0) {
    // Fallback if interface has no concrete implementers in schema
    return buildObjectShapeForType(
      selectionSet,
      parentTypeName,
      schemaIndex,
      fragmentsMap,
      config
    );
  }
  if (concreteTypes.length === 1) {
    return buildObjectShapeForType(
      selectionSet,
      concreteTypes[0],
      schemaIndex,
      fragmentsMap,
      config
    );
  }
  return concreteTypes
    .map((t) => buildObjectShapeForType(selectionSet, t, schemaIndex, fragmentsMap, config))
    .join(" | ");
}

function resolveNonNullOutputTypeNode(
  typeNode: TypeNode,
  subSelectionSet: SelectionSetNode | undefined,
  schemaIndex: SchemaIndex,
  fragmentsMap: Map<string, FragmentDefinitionNode>,
  config: MapperConfig
): string {
  if (typeNode.kind === "NonNullType") {
    return resolveNonNullOutputTypeNode(
      typeNode.type,
      subSelectionSet,
      schemaIndex,
      fragmentsMap,
      config
    );
  }
  if (typeNode.kind === "ListType") {
    const inner = resolveOutputTypeNode(
      typeNode.type,
      subSelectionSet,
      schemaIndex,
      fragmentsMap,
      config
    );
    return `Array<${inner}>`;
  }
  const name = typeNode.name.value;
  if (subSelectionSet) {
    return resolveSelectionSet(subSelectionSet, name, schemaIndex, fragmentsMap, config);
  }
  if (isScalar(name, schemaIndex)) {
    return `Scalars["${name}"]["output"]`;
  }
  if (schemaIndex.enums.has(name)) {
    return name;
  }
  return "any";
}

function resolveOutputTypeNode(
  typeNode: TypeNode,
  subSelectionSet: SelectionSetNode | undefined,
  schemaIndex: SchemaIndex,
  fragmentsMap: Map<string, FragmentDefinitionNode>,
  config: MapperConfig
): string {
  if (typeNode.kind === "NonNullType") {
    return resolveNonNullOutputTypeNode(
      typeNode.type,
      subSelectionSet,
      schemaIndex,
      fragmentsMap,
      config
    );
  }
  const inner = resolveNonNullOutputTypeNode(
    typeNode,
    subSelectionSet,
    schemaIndex,
    fragmentsMap,
    config
  );
  return `Maybe<${inner}>`;
}

export function generateTypeScriptFromGraphQL(
  queryContent: string,
  schemaPath: string,
  config: MapperConfig
): string {
  const schemaIndex = getSchemaIndex(schemaPath);
  const doc: DocumentNode = parse(queryContent, { noLocation: true });

  const sections: string[] = [];

  // 1. Base utility types & TypedDocumentNode
  sections.push(`import type { DocumentNode } from "graphql";

export interface TypedDocumentNode<
  Result = { [key: string]: any },
  Variables = { [key: string]: any },
> extends DocumentNode {
  /**
   * Type signature used for inference
   */
  __apiType?: (variables: Variables) => Result;
}

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };`);

  // 2. Scalars definition
  const scalarEntries: string[] = [
    `  ID: { input: string; output: string };`,
    `  String: { input: string; output: string };`,
    `  Boolean: { input: boolean; output: boolean };`,
    `  Int: { input: number; output: number };`,
    `  Float: { input: number; output: number };`,
  ];

  const allCustomScalars = new Set<string>([
    ...schemaIndex.scalars,
    ...Object.keys(config.scalars || {}),
  ]);

  for (const scalarName of allCustomScalars) {
    if (BUILTIN_SCALARS.has(scalarName)) continue;
    const mapped = config.scalars?.[scalarName] || "any";
    scalarEntries.push(`  ${scalarName}: { input: ${mapped}; output: ${mapped} };`);
  }

  sections.push(`export type Scalars = {\n${scalarEntries.join("\n")}\n};`);

  // 3. Enums from schema
  for (const [enumName, values] of schemaIndex.enums.entries()) {
    if (config.enumsAsTypes) {
      const unionMembers = values.map((v) => `"${v}"`);
      if (config.futureProofEnums) {
        unionMembers.push(`"%future added value"`);
      }
      const unionStr = unionMembers.length > 0 ? unionMembers.join(" | ") : "never";
      const objProps = values.map((v) => `  readonly ${v}: "${v}";`).join("\n");
      sections.push(
        `export type ${enumName} = ${unionStr};\nexport declare const ${enumName}: {\n${objProps}\n};`
      );
    } else {
      const members = values.map((v) => `  ${v} = "${v}",`).join("\n");
      sections.push(`export enum ${enumName} {\n${members}\n}`);
    }
  }

  // 4. Input Object types from schema
  for (const [inputName, fields] of schemaIndex.inputs.entries()) {
    const fieldLines: string[] = [];
    for (const field of fields) {
      const isRequired = field.type.kind === "NonNullType" && !field.defaultValue;
      if (isRequired) {
        const tsType = resolveInputTypeNode(field.type, schemaIndex, false);
        fieldLines.push(`  ${field.name.value}: ${tsType};`);
      } else {
        const unwrapped = field.type.kind === "NonNullType" ? field.type.type : field.type;
        const tsType = resolveInputTypeNode(unwrapped, schemaIndex, false);
        fieldLines.push(`  ${field.name.value}?: InputMaybe<${tsType}>;`);
      }
    }
    sections.push(`export type ${inputName} = {\n${fieldLines.join("\n")}\n};`);
  }

  // 5. Collect Fragments and Operations from query document
  const fragmentsMap = new Map<string, FragmentDefinitionNode>();
  const operations: OperationDefinitionNode[] = [];

  for (const def of doc.definitions) {
    if (def.kind === "FragmentDefinition") {
      fragmentsMap.set(def.name.value, def);
    } else if (def.kind === "OperationDefinition") {
      operations.push(def);
    }
  }

  // 6. Generate Fragment types and document exports
  for (const [fragName, fragDef] of fragmentsMap.entries()) {
    const fragTypeName = `${capitalize(fragName)}Fragment`;
    const condType = fragDef.typeCondition.name.value;
    const shape = resolveSelectionSet(
      fragDef.selectionSet,
      condType,
      schemaIndex,
      fragmentsMap,
      config
    );
    sections.push(`export type ${fragTypeName} = ${shape};`);
    sections.push(
      `export declare const ${fragName}: TypedDocumentNode<${fragTypeName}, Record<string, never>>;`
    );
  }

  // 7. Generate Operation Variables, Result types, and TypedDocumentNode exports
  let defaultExportName: string | undefined;

  for (const op of operations) {
    if (!op.name) continue;
    const opName = op.name.value;
    if (!defaultExportName) {
      defaultExportName = opName;
    }

    const opSuffix = capitalize(op.operation);
    const varTypeName = `${opName}${opSuffix}Variables`;
    const resTypeName = `${opName}${opSuffix}`;

    const varDefs = op.variableDefinitions || [];
    if (varDefs.length === 0) {
      sections.push(`export type ${varTypeName} = Exact<{ [key: string]: never }>;`);
    } else {
      const varLines: string[] = [];
      for (const v of varDefs) {
        const varName = v.variable.name.value;
        const isRequired = v.type.kind === "NonNullType" && !v.defaultValue;
        if (isRequired) {
          const tsType = resolveInputTypeNode(v.type, schemaIndex, true);
          varLines.push(`  ${varName}: ${tsType};`);
        } else {
          const unwrapped = v.type.kind === "NonNullType" ? v.type.type : v.type;
          const tsType = resolveInputTypeNode(unwrapped, schemaIndex, true);
          varLines.push(`  ${varName}?: InputMaybe<${tsType}>;`);
        }
      }
      sections.push(`export type ${varTypeName} = Exact<{\n${varLines.join("\n")}\n}>;`);
    }

    const rootTypeName = schemaIndex.rootTypes[op.operation];
    const resShape = resolveSelectionSet(
      op.selectionSet,
      rootTypeName,
      schemaIndex,
      fragmentsMap,
      config
    );
    sections.push(`export type ${resTypeName} = ${resShape};`);
    sections.push(
      `export declare const ${opName}: TypedDocumentNode<${resTypeName}, ${varTypeName}>;`
    );
  }

  if (!defaultExportName && fragmentsMap.size > 0) {
    defaultExportName = fragmentsMap.keys().next().value;
  }

  if (defaultExportName) {
    sections.push(`export default ${defaultExportName};`);
  }

  return sections.join("\n\n") + "\n";
}
