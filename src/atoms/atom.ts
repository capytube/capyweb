import { atom } from 'jotai';

interface userType {
  id: string | null;
  name: string | null;
  createdAt: number | null;
  totalEarnedCoins: number | null;
  todayEarnedCoins: {
    coins: number | null;
    timeStamp: number | null;
  } | null;
}

interface commentsType {
  id: string | null;
  streamId: string | null;
  content: string | null;
  user: {
    name: string | null;
    createdAt: number | null;
    id: string | null;
    updatedAt: string | null;
  };
}

interface RatingsAtom {
  id: string | null;
  ratingCounts: {
    capylove: number | null;
    capylike: number | null;
    capywow: number | null;
    capyangry: number | null;
    capyfire: number | null;
  } | null;
}

interface CapyList {
  id: string | null;
  capyName: string | null;
  capyDescription: string | null;
  availableCameras: {
    mainCam: string | null;
    foodCam: string | null;
    bedroomCam: string | null;
  } | null;
  createdAt: string | null;
}

interface CapybaraAtom {
  id: string | null;
  capyName: string | null;
  availableCameras: {
    mainCam: string | null;
    foodCam: string | null;
    bedroomCam: string | null;
  } | null;
  createdAt: string | null;
}

export const userAtom = atom<userType>({
  id: '',
  name: '',
  createdAt: 0,
  totalEarnedCoins: 0,
  todayEarnedCoins: {
    coins: 0,
    timeStamp: new Date().getTime(),
  },
});

export const walletAtom = atom<`0x${string}` | null>(null);
export const loadingAtom = atom<boolean>(false);

export const commentsAtom = atom<Array<commentsType> | []>([
  {
    id: null,
    streamId: null,
    content: null,
    user: {
      name: null,
      createdAt: null,
      id: null,
      updatedAt: null,
    },
  },
]);

export const ratingsAtom = atom<RatingsAtom>({
  id: '',
  ratingCounts: {
    capylove: null,
    capylike: null,
    capywow: null,
    capyangry: null,
    capyfire: null,
  },
});

export const capyListAtom = atom<Array<CapyList> | []>([
  {
    id: null,
    capyName: null,
    capyDescription: null,
    availableCameras: {
      mainCam: null,
      foodCam: null,
      bedroomCam: null,
    },
    createdAt: null,
  },
]);

export const capybaraAtom = atom<CapybaraAtom>({
  id: null,
  capyName: null,
  createdAt: null,
  availableCameras: {
    mainCam: null,
    foodCam: null,
    bedroomCam: null,
  },
});
