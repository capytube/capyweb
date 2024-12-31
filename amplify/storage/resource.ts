import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'capytubeDrive',
  access: (allow) => ({
    'pictures/*': [allow.guest.to(['read', 'write', 'delete'])],
  }),
});
