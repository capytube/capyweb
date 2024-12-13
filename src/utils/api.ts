import { getDefaultStore } from 'jotai';
import { generateClient } from 'aws-amplify/api';

import { capybaraAtom, commentsAtom, ratingsAtom } from '../atoms/atom';
import { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();
const ratings = defaultStore.get(ratingsAtom);
const capybara = defaultStore.get(capybaraAtom);

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
      (a: { createdAt: number | null }, b: { createdAt: number | null }) => (a?.createdAt ?? 0) - (b?.createdAt ?? 0),
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
        }),
      ) ?? [],
    );
  }

  return response;
}

export async function deleteComment(commentId: string) {
  return await client.models.Comment.delete({
    id: commentId,
  });
}

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

export async function getCapybara(id: string) {
  const response = await client.models.CapyList.get(
    {
      id,
    },
    {
      selectionSet: ['id', 'createdAt', 'capyName', 'availableCameras.*'],
    },
  );

  if (response?.data) {
    defaultStore.set(capybaraAtom, response?.data ?? { ...capybara });
  }

  return response;
}
