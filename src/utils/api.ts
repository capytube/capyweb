import { getDefaultStore } from 'jotai';
import { generateClient } from 'aws-amplify/api';

import { userAtom } from '../atoms/atom';
import { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();
const user = defaultStore.get(userAtom);

export async function getUserProfile(userId: string) {
  const response = await client.models.displayName.get({
    id: userId,
  });

  if (response?.data?.id) {
    defaultStore.set(userAtom, response?.data ?? { ...user });
  }

  return response;
}

export async function updateUserProfile({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  const response = await client.models.displayName.update({
    id: userId,
    name: name,
  });
  if (response?.data?.name) {
    await getUserProfile(userId);
  }

  return response;
}
