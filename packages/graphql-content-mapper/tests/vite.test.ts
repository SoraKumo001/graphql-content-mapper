import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { graphqlContentMapper } from "../src/vite.js";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const schemaPath = path.join(FIXTURES_DIR, "schema.graphql");
const queryPath = path.join(FIXTURES_DIR, "query.graphql");

describe("vite plugin", () => {
  const querySource = fs.readFileSync(queryPath, "utf-8");

  it("should ignore non-graphql files", () => {
    const plugin = graphqlContentMapper();
    const res = (plugin.transform as any).call({}, "console.log('hi')", "src/main.ts");
    expect(res).toBeNull();
  });

  it("should transform .graphql files and watch schema file", () => {
    const plugin = graphqlContentMapper({ schema: schemaPath });
    const addWatchFile = vi.fn();

    const context = { addWatchFile };
    const res = (plugin.transform as any).call(context, querySource, queryPath);

    expect(res).not.toBeNull();
    expect(res.code).toContain("export const GetUsers =");
    expect(res.code).toContain("export const UserRole =");
    expect(addWatchFile).toHaveBeenCalledWith(schemaPath);
  });
});
