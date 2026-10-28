/**
 * @type { import("next").NextConfig}
 */
const withGraphQL = require("graphql-content-mapper/next");

const config = {
  serverExternalPackages: ["@whatwg-node"],
  typescript: {
    // Next.js internal typecheck uses standard tsc without --runExternalCode
    // We run typecheck via 'npm run typecheck'
    ignoreBuildErrors: true,
  },
};

module.exports = withGraphQL(config);
