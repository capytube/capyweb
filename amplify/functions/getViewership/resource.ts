import { defineFunction } from "@aws-amplify/backend";

export const getViewership = defineFunction({
  name: "getViewership",
  entry: "./handler.ts",
  environment: {
    VITE_LIVEPEER_API_KEY: "7f09548e-4e52-4744-9c85-6f00eb999b62",
  },
});
