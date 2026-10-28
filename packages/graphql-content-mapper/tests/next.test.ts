import { describe, expect, it } from "vitest";
import { withGraphQLContentMapper } from "../src/next.js";

describe("next.js helper", () => {
  it("should configure webpack rules", () => {
    const nextConfig = withGraphQLContentMapper({
      reactStrictMode: true,
    });

    expect(nextConfig.reactStrictMode).toBe(true);
    expect(typeof nextConfig.webpack).toBe("function");

    const webpackConfig = { module: { rules: [] as any[] } };
    nextConfig.webpack(webpackConfig, {});

    expect(webpackConfig.module.rules.length).toBe(1);
    expect(webpackConfig.module.rules[0].test).toEqual(/\.(graphql|gql)$/);
  });

  it("should configure turbopack rules", () => {
    const nextConfig = withGraphQLContentMapper(
      {},
      { schema: "./custom.graphql" }
    );

    expect(nextConfig.turbopack?.rules).toBeDefined();
    expect(nextConfig.turbopack?.rules["*.graphql"]).toBeDefined();
    expect(nextConfig.turbopack?.rules["*.graphql"].as).toBe("*.js");
  });
});
