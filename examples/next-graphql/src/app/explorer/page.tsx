import { printSchema } from "graphql";
import { schema } from "@/app/graphql/schema";
import { GraphQLExplorer } from "@/components/GraphQLExplorer";

export const dynamic = "force-static";

export default function ExplorerPage() {
  const schemaStr = printSchema(schema);
  return <GraphQLExplorer schema={schemaStr} />;
}
