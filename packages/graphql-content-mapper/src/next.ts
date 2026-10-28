import * as path from "node:path";
import type { MapperConfig } from "./config.js";

export type GraphQLContentMapperNextOptions = Partial<MapperConfig> & {
  schema?: string;
};

export interface NextConfig {
  webpack?: (config: any, options: any) => any;
  turbopack?: {
    rules?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export function withGraphQLContentMapper(
  nextConfig: NextConfig = {},
  options?: GraphQLContentMapperNextOptions
): NextConfig {
  const loaderPath = path.resolve(__dirname, "./loader.js");
  const loaderOptions = options && Object.keys(options).length > 0 ? options : undefined;

  return {
    ...nextConfig,
    webpack: (config: any, webpackOptions: any) => {
      config.module.rules.push({
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: loaderPath,
        options: loaderOptions,
      });

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, webpackOptions);
      }
      return config;
    },
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...nextConfig.turbopack?.rules,
        "*.graphql": {
          loaders: loaderOptions
            ? [{ loader: loaderPath, options: loaderOptions }]
            : [loaderPath],
          as: "*.js",
        },
        "*.gql": {
          loaders: loaderOptions
            ? [{ loader: loaderPath, options: loaderOptions }]
            : [loaderPath],
          as: "*.js",
        },
      },
    },
  };
}

export default withGraphQLContentMapper;

try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = withGraphQLContentMapper;
    module.exports.withGraphQLContentMapper = withGraphQLContentMapper;
  }
} catch {
  // Ignore in pure ESM environment
}
