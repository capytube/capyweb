import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { userAtom } from '../../store/atoms/userAtom';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function getUserById(userId: string) {
  const response = await client.models.User.get({ id: userId });

  if (response?.data?.id) {
    defaultStore.set(userAtom, response?.data);
  }

  return response;
}

export async function getUserByWalletAddress(walletAddress: string) {
  const response = await client.models.User.getUserByWalletAddress({ wallet_address: walletAddress });

  if (response?.data?.length && response?.data?.[0].id) {
    defaultStore.set(userAtom, response?.data?.[0]);
  }

  return response;
}

export async function createUser({ userName, wallet_address }: { userName: string; wallet_address: string }) {
  const response = await client.models.User.create({
    username: userName,
    wallet_address: wallet_address,
  });

  if (response?.data?.id) {
    await getUserByWalletAddress(wallet_address);
  }

  return response;
}

export async function updateUser({ userId, userName }: { userId: string; userName: string }) {
  const response = await client.models.User.update({
    id: userId,
    username: userName,
  });

  if (response?.data?.username) {
    await getUserById(userId);
  }

  return response;
}

export async function deleteUserById(userId: string) {
  const response = await client.models.User.delete({ id: userId });

  return response;
}
