import { defineFunction } from "@aws-amplify/backend";

export const getStream = defineFunction({
  // optionally specify a name for the Function (defaults to directory name)
  name: "getStream",
  // optionally specify a path to your handler (defaults to "./handler.ts")
  entry: "./handler.ts",
  environment: {
    VITE_LIVEPEER_API_KEY: "3e2c0df0-f6bd-4a0b-8b1f-57fee7f68661",
  },
});
