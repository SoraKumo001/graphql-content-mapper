import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import loader from "../src/loader.js";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const schemaPath = path.join(FIXTURES_DIR, "schema.graphql");
const queryPath = path.join(FIXTURES_DIR, "query.graphql");

describe("webpack / turbopack loader", () => {
  const querySource = fs.readFileSync(queryPath, "utf-8");

  it("should transform .graphql content, invoke cacheable and addDependency", () => {
    const cacheable = vi.fn();
    const addDependency = vi.fn();
    const getOptions = vi.fn(() => ({ schema: schemaPath }));

    const context = {
      cacheable,
      addDependency,
      getOptions,
      rootContext: FIXTURES_DIR,
    };

    const code = loader.call(context, querySource);

    expect(cacheable).toHaveBeenCalled();
    expect(addDependency).toHaveBeenCalledWith(schemaPath);
    expect(code).toContain("export const GetUsers =");
    expect(code).toContain("export const UserRole =");
  });
});
