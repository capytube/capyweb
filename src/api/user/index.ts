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

export async function createUser({
  id,
  userName,
  wallet_address,
  email_address,
}: {
  id: string;
  userName: string;
  wallet_address: string;
  email_address: string;
}) {
  const response = await client.models.User.create({
    id: id,
    username: userName,
    email: email_address,
    wallet_address: wallet_address,
    balance: 0,
    totalWatchTime: 0,
    signupSource: 'capytube',
  });

  if (response?.data?.id) {
    await getUserById(id);
  }

  return response;
}

export async function updateUserDetails({ userId, userName }: { userId: string; userName: string }) {
  const response = await client.models.User.update({
    id: userId,
    username: userName,
  });

  if (response?.data?.id) {
    await getUserById(userId);
  }

  return response;
}

export async function updateUserWatchTime({ userId, watchTime }: { userId: string; watchTime: number }) {
  const response = await client.models.User.update({
    id: userId,
    totalWatchTime: watchTime,
  });

  if (response?.data?.id) {
    await getUserById(userId);
  }

  return response;
}

export async function updateUserTotalBalance({ userId, totalBalance }: { userId: string; totalBalance: number }) {
  const response = await client.models.User.update({
    id: userId,
    balance: totalBalance,
  });

  if (response?.data?.id) {
    await getUserById(userId);
  }

  return response;
}

export async function deleteUserById(userId: string) {
  const response = await client.models.User.delete({ id: userId });

  return response;
}
