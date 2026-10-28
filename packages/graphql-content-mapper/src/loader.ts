import process from "node:process";
import { compileGraphQLToEsm } from "./compiler.js";
import type { MapperConfig } from "./config.js";

export interface LoaderContext {
  cacheable?: () => void;
  addDependency?: (file: string) => void;
  getOptions?: () => Record<string, any>;
  rootContext?: string;
  [key: string]: any;
}

export type GraphQLContentMapperLoaderOptions = Partial<MapperConfig> & {
  schema?: string;
};

export default function graphqlContentMapperLoader(this: LoaderContext, source: string): string {
  if (this.cacheable) {
    this.cacheable();
  }

  const options = typeof this.getOptions === "function" ? this.getOptions() : {};
  const projectDir = this.rootContext || process.cwd();
  const { code, schemaPath } = compileGraphQLToEsm(source, projectDir, options);

  if (this.addDependency && schemaPath) {
    this.addDependency(schemaPath);
  }

  return code;
}

// Support CommonJS require
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = graphqlContentMapperLoader;
  }
} catch {
  // Ignore in pure ESM environment
}
