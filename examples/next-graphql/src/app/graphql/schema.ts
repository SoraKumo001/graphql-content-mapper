import path from "path";
import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import PrismaUtils from "@pothos/plugin-prisma-utils";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import PothosPrismaGeneratorPlugin from "pothos-prisma-generator";
import PothosQueryGeneratorPlugin from "pothos-query-generator";
import PothosSchemaExporterPlugin from "pothos-schema-exporter";
import type PrismaTypes from "../../generated/pothos-types";
import { getDatamodel } from "../../generated/pothos-types";

const connectionString = process.env.DATABASE_URL;
const dbSchema = connectionString
  ? new URL(connectionString).searchParams.get("schema") ?? undefined
  : undefined;
const adapter = new PrismaPg({ connectionString }, { schema: dbSchema });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;

/**
 * Create a new schema builder instance
 */
export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
}>({
  plugins: [
    PrismaPlugin,
    PrismaUtils,
    PothosPrismaGeneratorPlugin,
    PothosSchemaExporterPlugin,
    PothosQueryGeneratorPlugin,
  ],
  prisma: {
    client: prismaClient,
    dmmf: getDatamodel(),
  },
  pothosSchemaExporter: {
    output:
      process.env.NODE_ENV === "development" &&
      path.join(process.cwd(), "graphql", "schema.graphql"),
  },
  pothosQueryGenerator: {
    output:
      process.env.NODE_ENV === "development" &&
      path.join(process.cwd(), "graphql", "query.graphql"),
  },
});

export const schema = builder.toSchema({ sortSchema: false });
