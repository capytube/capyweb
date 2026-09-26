import { defineFunction, secret } from "@aws-amplify/backend";

export const getViewership = defineFunction({
  name: "getViewership",
  entry: "./handler.ts",
  environment: {
    VITE_LIVEPEER_API_KEY: secret("LIVEPEER_API_KEY"),
  },
});
