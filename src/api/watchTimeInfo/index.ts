import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

export interface WatchTimeInfoType {
  id: string; // user id of the authenticated user
  watchTime: number; // Total watch time in seconds
  lastUpdated: number; // Timestamp of the last update
}

export async function getUsersWatchTime(userId: string) {
  const response = await client.models.WatchTimeInfo.get({ id: userId });

  return response;
}

export async function createUsersWatchTimeOnce({ userId }: { userId: string }) {
  const response = await client.models.WatchTimeInfo.create({
    id: userId,
    watchTime: 0,
    lastUpdated: new Date().getTime(),
  });

  return response;
}

export async function updateUsersWatchTime(params: WatchTimeInfoType) {
  const response = await client.models.WatchTimeInfo.update({
    id: params?.id,
    watchTime: params?.watchTime,
    lastUpdated: params?.lastUpdated,
  });

  return response;
}
