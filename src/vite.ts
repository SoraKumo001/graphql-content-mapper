import { compileGraphQLToEsm } from "./compiler.js";
import type { MapperConfig } from "./config.js";

export type VitePluginOptions = Partial<MapperConfig> & {
  schema?: string;
};

export function graphqlContentMapper(options?: VitePluginOptions) {
  return {
    name: "vite-plugin-graphql-content-mapper",
    enforce: "pre" as const,
    transform(this: any, code: string, id: string) {
      // Ignore queries with query params (e.g. ?raw)
      const cleanId = id.split("?")[0];
      if (!/\.(graphql|gql)$/.test(cleanId)) {
        return null;
      }

      const { code: esmCode, schemaPath } = compileGraphQLToEsm(
        code,
        undefined,
        options
      );

      if (this.addWatchFile && schemaPath) {
        this.addWatchFile(schemaPath);
      }

      return {
        code: esmCode,
        map: { mappings: "" },
      };
    },
  };
}

export default graphqlContentMapper;
