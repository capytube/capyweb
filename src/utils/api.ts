import { getDefaultStore } from 'jotai';
import { generateClient } from 'aws-amplify/api';

import { capybaraAtom, capyListAtom, commentsAtom, ratingsAtom, userAtom } from '../atoms/atom';
import { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();
const user = defaultStore.get(userAtom);
const ratings = defaultStore.get(ratingsAtom);
const capybara = defaultStore.get(capybaraAtom);
const capyList = defaultStore.get(capyListAtom);

export async function getUserProfile(userId: string) {
  const response = await client.models.User.get(
    {
      id: userId,
    },
    {
      selectionSet: ['id', 'name', 'totalEarnedCoins', 'todayEarnedCoins.*', 'createdAt'],
    },
  );

  if (response?.data?.id) {
    defaultStore.set(userAtom, response?.data ?? { ...user });
  }

  return response;
}

export async function updateUserProfile({ name, userId }: { name: string; userId: string }) {
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

export async function getCapyList() {
  const response = await client.models.CapyList.list({
    selectionSet: ['id', 'capyName', 'capyDescription', 'availableCameras.*', 'createdAt'],
  });

  if (response?.data) {
    const sortedData = response?.data
      .sort(function (a, b) {
        const x = a?.capyName?.toLowerCase() ?? '';
        const y = b?.capyName?.toLowerCase() ?? '';
        if (x > y) {
          return 1;
        }
        if (x < y) {
          return -1;
        }
        return 0;
      })
      ?.reverse();

    defaultStore.set(capyListAtom, sortedData ?? { ...capyList });
  }

  return response;
}

export async function createCapy({
  capyName,
  capyDescription,
  availableCameras,
}: {
  capyName: string;
  capyDescription: string;
  availableCameras: {
    mainCam: string;
    foodCam: string;
    bedroomCam: string;
  };
}) {
  const response = await client.models.CapyList.create({ capyName, capyDescription, availableCameras });
  return response;
}

export async function deleteCapy({ id }: { id: string }) {
  const response = await client.models.CapyList.delete({ id });
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
