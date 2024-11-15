import { getDefaultStore } from 'jotai';
import { generateClient } from 'aws-amplify/api';

import { commentsAtom, userAtom } from '../atoms/atom';
import { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();
const user = defaultStore.get(userAtom);

export async function getUserProfile(userId: string) {
  const response = await client.models.User.get(
    {
      id: userId,
    },
    {
      selectionSet: [
        'id',
        'name',
        'totalEarnedCoins',
        'todayEarnedCoins.*',
        'createdAt',
      ],
    }
  );

  if (response?.data?.id) {
    console.log('user', response);
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
  const response = await client.models.User.update({
    id: userId,
    name: name,
  });
  if (response?.data?.name) {
    await getUserProfile(userId);
  }

  return response;
}

export async function updateUserCoins({
  totalCoins,
  earnedCoins,
  timeStamp,
  userId,
}: {
  totalCoins: number;
  earnedCoins: number;
  timeStamp: number;
  userId: string;
}) {
  const response = await client.models.User.update({
    id: userId,
    totalEarnedCoins: totalCoins,
    todayEarnedCoins: {
      coins: earnedCoins,
      timeStamp,
    },
  });
  if (response?.data?.name) {
    await getUserProfile(userId);
  }

  return response;
}

//'fa7ahoikpf19u1e9'

interface addComment {
  streamId: string;
  userId: string;
  content: string;
}

export async function addComment({ streamId, userId, content }: addComment) {
  const response = await client.models.Comment.create({
    streamId,
    userId,
    content,
    createdAt: new Date().getTime(),
  });

  return response;
}

export async function getListOfComments({ streamId }: { streamId: string }) {
  const response = await client.models.Comment.list({
    selectionSet: ['content', 'streamId', 'id', 'user.*', 'createdAt'],
    filter: {
      streamId: {
        eq: streamId,
      },
    },
  });

  if (response?.data?.length) {
    const sortedData = response?.data?.sort(
      (a: { createdAt: number | null }, b: { createdAt: number | null }) =>
        (a?.createdAt ?? 0) - (b?.createdAt ?? 0)
    );
    defaultStore.set(
      commentsAtom,
      sortedData?.map(
        (comment: {
          id: string | null;
          streamId: string | null;
          content: string | null;
          user: {
            name: string | null;
            createdAt: number | null;
            id: string | null;
            updatedAt: string | null;
          };
        }) => ({
          id: comment.id ?? null,
          streamId: comment.streamId ?? null,
          content: comment.content ?? null,
          user: {
            name: comment.user?.name ?? null,
            createdAt: comment.user?.createdAt ?? null,
            id: comment.user?.id ?? '',
            updatedAt: comment.user?.updatedAt ?? '',
          },
        })
      ) ?? []
    );
  }

  return response;
}

export async function deleteComment(commentId: string) {
  return await client.models.Comment.delete({
    id: commentId,
  });
}
