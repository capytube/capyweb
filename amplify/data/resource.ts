import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { getStream } from "../functions/getStream/resource";

const schema = a.schema({
  getStream: a
    .query()
    .arguments({
      streamId: a.string(),
    })
    .returns(a.string())
    .handler(a.handler.function(getStream))
    .authorization((allow) => [allow.publicApiKey()]),

  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
  // Comment: a
  //   .model({
  //     streamId: a.string(),
  //     content: a.string(),
  //     userId: a.string(),
  //     createdAt: a.timestamp(),
  //   })
  //   .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
