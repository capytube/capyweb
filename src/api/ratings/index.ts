import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { ratingsAtom } from '../../store/atoms/ratingsAtom';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();
const ratings = defaultStore.get(ratingsAtom);

export async function getRatings(streamId: string) {
  const response = await client.models.Ratings.get(
    {
      id: streamId,
    },
    {
      selectionSet: ['id', 'ratingCounts.*'],
    },
  );

  if (response?.data) {
    defaultStore.set(ratingsAtom, response?.data ?? { ...ratings });
  }

  return response;
}

export async function updateRatings(streamId: string, countData: any) {
  const response = await client.models.Ratings.update({
    id: streamId,
    ratingCounts: {
      ...countData,
    },
  });

  if (response?.data?.id) {
    await getRatings(streamId);
  }

  return response;
}
