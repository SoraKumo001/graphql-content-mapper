import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { compileGraphQLToEsm } from "../src/compiler.js";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const schemaPath = path.join(FIXTURES_DIR, "schema.graphql");
const queryPath = path.join(FIXTURES_DIR, "query.graphql");

describe("compiler", () => {
  const querySource = fs.readFileSync(queryPath, "utf-8");

  it("should compile query document into pure ESM format with named exports", () => {
    const { code } = compileGraphQLToEsm(querySource, FIXTURES_DIR, {
      schema: schemaPath,
    });

    // Named exports for operations
    expect(code).toContain("export const GetUsers =");
    expect(code).toContain("export const AddUser =");

    // Named export for fragment
    expect(code).toContain("export const UserFields =");

    // Named export for enum from schema
    expect(code).toContain("export const UserRole =");

    // Default export
    expect(code).toContain("export default GetUsers;");
  });

  it("should include referenced fragments inside operation DocumentNode definitions", () => {
    const { code } = compileGraphQLToEsm(querySource, FIXTURES_DIR, {
      schema: schemaPath,
    });

    // Evaluate the code in a sandbox or parse it
    // Check that GetUsers definitions include both OperationDefinition and FragmentDefinition
    const match = code.match(/export const GetUsers = (\{.*?\});/s);
    expect(match).not.toBeNull();
    const getUsersDoc = JSON.parse(match![1]);

    expect(getUsersDoc.kind).toBe("Document");
    const kinds = getUsersDoc.definitions.map((d: any) => d.kind);
    expect(kinds).toContain("OperationDefinition");
    expect(kinds).toContain("FragmentDefinition");

    const names = getUsersDoc.definitions.map((d: any) => d.name?.value);
    expect(names).toContain("GetUsers");
    expect(names).toContain("UserFields");
  });

  it("should correctly extract enum key-values from schema", () => {
    const { code } = compileGraphQLToEsm(querySource, FIXTURES_DIR, {
      schema: schemaPath,
    });

    const match = code.match(/export const UserRole = (\{.*?\});/);
    expect(match).not.toBeNull();
    const roleEnum = JSON.parse(match![1]);

    expect(roleEnum).toEqual({
      ADMIN: "ADMIN",
      USER: "USER",
      GUEST: "GUEST",
    });
  });
});
