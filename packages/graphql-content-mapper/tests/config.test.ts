import * as path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import { resolveConfig, loadTsConfigOptions } from "../src/config.js";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

describe("config", () => {
  it("should resolve default options when no configuration is present", () => {
    const res = resolveConfig(__dirname);
    expect(res.config.schema).toBe("graphql/schema.graphql");
    expect(res.config.scalars).toEqual({});
  });

  it("should load options from tsconfig.json (contentMappers[].options)", () => {
    const options = loadTsConfigOptions(FIXTURES_DIR, "tsconfig.json");
    expect(options.schema).toBe("./schema.graphql");
    expect(options.scalars).toEqual({
      DateTime: "string",
      CustomJSON: "Record<string, unknown>",
    });
    expect(options.skipTypename).toBe(true);
  });

  it("should prioritize tsconfig.json options when resolving config", () => {
    const res = resolveConfig(FIXTURES_DIR, undefined, "tsconfig.json");
    expect(res.schemaPath).toBe(path.join(FIXTURES_DIR, "schema.graphql"));
    expect(res.config.scalars).toEqual({
      DateTime: "string",
      CustomJSON: "Record<string, unknown>",
    });
    expect(res.config.skipTypename).toBe(true);
  });

  it("should prioritize explicit options over tsconfig.json options", () => {
    const res = resolveConfig(
      FIXTURES_DIR,
      {
        schema: "./custom-override.graphql",
        scalars: { DateTime: "Date" },
      },
      "tsconfig.json"
    );
    expect(res.schemaPath).toBe(path.join(FIXTURES_DIR, "custom-override.graphql"));
    expect(res.config.scalars.DateTime).toBe("Date");
    // Other scalars from tsconfig are merged
    expect(res.config.scalars.CustomJSON).toBe("Record<string, unknown>");
  });

  it("should handle environment variable override", () => {
    process.env.GRAPHQL_SCHEMA_PATH = "env/my-schema.graphql";
    try {
      const res = resolveConfig(__dirname);
      expect(res.config.schema).toBe("env/my-schema.graphql");
    } finally {
      delete process.env.GRAPHQL_SCHEMA_PATH;
    }
  });
});
