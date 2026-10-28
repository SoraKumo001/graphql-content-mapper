import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";

export interface MapperConfig {
  schema: string;
  scalars: Record<string, string>;
  skipTypename?: boolean;
  enumsAsTypes?: boolean;
  futureProofEnums?: boolean;
  codegenConfig?: Record<string, any>;
}

const DEFAULT_CONFIG: MapperConfig = {
  schema: "graphql/schema.graphql",
  scalars: {},
  skipTypename: false,
};

/**
 * Extract schema path from CLI arguments (e.g., --schema <path> or --schema=<path>)
 */
function getCliSchemaArg(): string | undefined {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--schema" && i + 1 < args.length) {
      return args[i + 1];
    }
    if (arg.startsWith("--schema=")) {
      return arg.slice("--schema=".length);
    }
  }
  return undefined;
}

/**
 * Extract schema path from environment variables
 */
function getEnvSchema(): string | undefined {
  return process.env.GRAPHQL_SCHEMA_PATH || process.env.GRAPHQL_SCHEMA;
}

/**
 * Strip comments and parse JSON (handles comments in tsconfig.json)
 */
function parseJsonWithComments(jsonString: string): any {
  const stripped = jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
    g ? "" : m
  );
  return JSON.parse(stripped);
}

/**
 * Load options from tsconfig.json (TypeScript 7.1 contentMappers[].options)
 */
export function loadTsConfigOptions(projectDir: string, configFileName?: string): Partial<MapperConfig> {
  const tsconfigPath = configFileName
    ? path.isAbsolute(configFileName)
      ? configFileName
      : path.join(projectDir, configFileName)
    : path.join(projectDir, "tsconfig.json");

  if (!fs.existsSync(tsconfigPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = parseJsonWithComments(content);

    if (Array.isArray(tsconfig.contentMappers)) {
      const mapper = tsconfig.contentMappers.find(
        (m: any) =>
          m &&
          typeof m === "object" &&
          (m.package === "graphql-content-mapper" ||
            m.package?.endsWith("/graphql-content-mapper") ||
            m.name === "graphql-content-mapper")
      );
      if (mapper && mapper.options && typeof mapper.options === "object") {
        return mapper.options;
      }
    }
  } catch {
    // Ignore JSON parse error in tsconfig.json
  }

  return {};
}

/**
 * Load configuration from config files or package.json
 */
function loadUserConfig(projectDir: string): Partial<MapperConfig> {
  // 1. graphql-content-mapper.config.json
  const customConfigPath = path.join(projectDir, "graphql-content-mapper.config.json");
  if (fs.existsSync(customConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(customConfigPath, "utf-8"));
    } catch {
      // Ignore
    }
  }

  // 2. .graphqlrc or .graphqlrc.json
  for (const rcName of [".graphqlrc.json", ".graphqlrc", "graphql.config.json"]) {
    const rcPath = path.join(projectDir, rcName);
    if (fs.existsSync(rcPath)) {
      try {
        const rc = JSON.parse(fs.readFileSync(rcPath, "utf-8"));
        if (typeof rc.schema === "string") {
          return { schema: rc.schema };
        }
      } catch {
        // Ignore
      }
    }
  }

  // 3. package.json
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.graphqlContentMapper) {
        return pkg.graphqlContentMapper;
      }
    } catch {
      // Ignore
    }
  }

  return {};
}

export function resolveConfig(
  projectDir: string = process.cwd(),
  explicitOptions?: Partial<MapperConfig> | string,
  configFileName?: string
): {
  config: MapperConfig;
  schemaPath: string;
} {
  const explicitObj: Partial<MapperConfig> =
    typeof explicitOptions === "string"
      ? { schema: explicitOptions }
      : explicitOptions || {};

  // Priority order:
  // 1. Explicit options (passed directly to function / loader / plugin)
  // 2. CLI argument (--schema)
  // 3. Environment variable (GRAPHQL_SCHEMA_PATH)
  // 4. tsconfig.json contentMappers[].options (Pattern A)
  // 5. Config files (package.json / .graphqlrc / graphql-content-mapper.config.json)
  // 6. Default config
  const tsConfigOptions = loadTsConfigOptions(projectDir, configFileName);
  const userConfig = loadUserConfig(projectDir);

  const mergedScalars = {
    ...DEFAULT_CONFIG.scalars,
    ...userConfig.scalars,
    ...tsConfigOptions.scalars,
    ...explicitObj.scalars,
  };

  const resolvedSchema =
    explicitObj.schema ||
    getCliSchemaArg() ||
    getEnvSchema() ||
    tsConfigOptions.schema ||
    userConfig.schema ||
    DEFAULT_CONFIG.schema;

  const config: MapperConfig = {
    schema: resolvedSchema,
    scalars: mergedScalars,
    skipTypename:
      explicitObj.skipTypename ??
      tsConfigOptions.skipTypename ??
      userConfig.skipTypename ??
      DEFAULT_CONFIG.skipTypename,
    enumsAsTypes:
      explicitObj.enumsAsTypes ??
      tsConfigOptions.enumsAsTypes ??
      userConfig.enumsAsTypes,
    futureProofEnums:
      explicitObj.futureProofEnums ??
      tsConfigOptions.futureProofEnums ??
      userConfig.futureProofEnums,
    codegenConfig: {
      ...userConfig.codegenConfig,
      ...tsConfigOptions.codegenConfig,
      ...explicitObj.codegenConfig,
    },
  };

  const schemaPath = path.isAbsolute(config.schema)
    ? config.schema
    : path.join(projectDir, config.schema);

  return { config, schemaPath };
}
