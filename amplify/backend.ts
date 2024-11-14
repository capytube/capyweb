import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { getStream } from "./functions/getStream/resource";
import { getViewership } from "./functions/getViewership/resource";

defineBackend({
  auth,
  data,
  getStream,
  getViewership,
});
