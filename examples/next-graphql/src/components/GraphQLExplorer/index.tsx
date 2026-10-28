"use client";

import { ApolloExplorer } from "@apollo/explorer/react";
import { FC } from "react";

export const GraphQLExplorer: FC<{ schema: string }> = ({ schema }) => {
  return (
    <ApolloExplorer
      className="fixed inset-0"
      schema={schema}
      endpointUrl="/graphql"
      persistExplorerState={true}
      handleRequest={(url, option) =>
        fetch(url, { ...option, credentials: "same-origin" })
      }
    />
  );
};
