import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { getStream } from './functions/getStream/resource';
import { getViewership } from './functions/getViewership/resource';

defineBackend({
  auth,
  data,
  storage,
  getStream,
  getViewership,
});
